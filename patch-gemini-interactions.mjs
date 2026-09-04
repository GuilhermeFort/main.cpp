import fs from 'node:fs';

const file='lib/gemini.ts';
let src=fs.readFileSync(file,'utf8');

const start=src.indexOf('function toJsonSchema');
const end=src.indexOf('const artifactSchema=');
if(start<0||end<0||end<=start) throw new Error('Bloco generate do Gemini não encontrado para patch.');

const replacement=`async function generate(apiKey:string,systemInstruction:string,input:string,maxOutputTokens:number,responseSchema?:object,_legacyTemperature?:number){
  const isLargeCase=!!(responseSchema as any)?.properties?.characters;
  const tokenLimit=isLargeCase?18000:Math.max(maxOutputTokens,1200);
  const attempts=isLargeCase?2:1;
  let lastError:any=null;

  for(let attempt=0;attempt<attempts;attempt++){
    const controller=new AbortController();
    // Mantém a soma dos retries abaixo do teto de 60s da Function.
    const timeoutMs=isLargeCase?(attempt===0?36000:16000):28000;
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const compactHint=attempt===0?'':'\\nIMPORTANTE: a resposta anterior não terminou. Refaça o MESMO tipo de caso de forma bem mais compacta, preservando todos os campos obrigatórios, quantidades e coerência.';
      const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',{
        method:'POST',
        headers:{'x-goog-api-key':apiKey,'Content-Type':'application/json'},
        signal:controller.signal,
        body:JSON.stringify({
          system_instruction:{parts:[{text:systemInstruction}]},
          contents:[{role:'user',parts:[{text:input+compactHint}]}],
          generationConfig:{
            maxOutputTokens:tokenLimit,
            responseMimeType:'application/json',
            thinkingConfig:{thinkingLevel:'MINIMAL'},
            ...(responseSchema?{responseSchema}:{}),
          }
        })
      });

      const raw=await response.text();
      let data:any=null;
      try{data=raw?JSON.parse(raw):null}catch{}
      if(!response.ok){
        const message=data?.error?.message||data?.message||raw||\`Falha do Gemini (\${response.status}).\`;
        throw new Error(message);
      }

      const candidate=data?.candidates?.[0];
      const text=(candidate?.content?.parts||[]).map((part:any)=>part?.text||'').join('').trim();
      const finishReason=String(candidate?.finishReason||'');
      if(!text) throw new Error('O Gemini devolveu uma resposta vazia.');

      const cleaned=text.replace(/^\\s*\`\`\`(?:json)?\\s*/i,'').replace(/\\s*\`\`\`\\s*$/,'').trim();
      try{return JSON.parse(cleaned)}catch{
        console.error('Gemini JSON parse failure:',{attempt,finishReason,length:cleaned.length,start:cleaned.slice(0,160),end:cleaned.slice(-160)});
        const truncated=/MAX_TOKENS|LENGTH/i.test(finishReason)||(!cleaned.endsWith('}')&&!cleaned.endsWith(']'));
        if(truncated&&attempt+1<attempts){lastError=new Error('Resposta truncada');continue;}
        throw new Error(truncated?'A geração do caso foi cortada antes de terminar. Gere novamente.':'O Gemini respondeu, mas o JSON não pôde ser lido.');
      }
    }catch(error:any){
      lastError=error;
      if(error?.name==='AbortError'&&attempt+1<attempts) continue;
      if(error?.name==='AbortError') throw new Error('O Gemini demorou demais para gerar o caso. Tente novamente.');
      throw error;
    }finally{clearTimeout(timer);}
  }
  throw lastError||new Error('O Gemini não conseguiu concluir a geração.');
}

`;

src=src.slice(0,start)+replacement+src.slice(end);
src=src.replace(
  "const answerSchema={type:'OBJECT',required:['reply'],properties:{reply:{type:'STRING'},revealClueKey:{type:'STRING',nullable:true}}};",
  "const answerSchema={type:'OBJECT',required:['reply'],properties:{reply:{type:'STRING'},revealClueKey:{type:'STRING'}}};"
);
src=src.replace(
  'Retorne {\"reply\":string,\"revealClueKey\":string|null}.',
  'Retorne {\"reply\":string}. Inclua revealClueKey apenas quando uma pista real for legitimamente descoberta.'
);

// Liga fisicamente o mundo às pistas canônicas para buscas nunca dependerem de adivinhação textual.
src=src.replace(
  "required:['key','name','kind','description','x','y','knownInitially'],properties:{key:{type:'STRING'},name:{type:'STRING'},kind:{type:'STRING'},description:{type:'STRING'},x:{type:'INTEGER'},y:{type:'INTEGER'},knownInitially:{type:'BOOLEAN'}}",
  "required:['key','name','kind','description','x','y','knownInitially','clueKeys'],properties:{key:{type:'STRING'},name:{type:'STRING'},kind:{type:'STRING'},description:{type:'STRING'},x:{type:'INTEGER'},y:{type:'INTEGER'},knownInitially:{type:'BOOLEAN'},clueKeys:{type:'ARRAY',items:{type:'STRING'}}}"
);
src=src.replace(
  "required:['key','ownerCharacterId','type','label','description','knownInitially','requiresWarrant','artifacts'],properties:{key:{type:'STRING'},ownerCharacterId:{type:'STRING'},type:{type:'STRING'},label:{type:'STRING'},description:{type:'STRING'},knownInitially:{type:'BOOLEAN'},requiresWarrant:{type:'BOOLEAN'},artifacts:{type:'ARRAY',items:artifactSchema}}",
  "required:['key','ownerCharacterId','type','label','description','locationKey','knownInitially','requiresWarrant','revealedByClueKeys','artifacts'],properties:{key:{type:'STRING'},ownerCharacterId:{type:'STRING'},type:{type:'STRING'},label:{type:'STRING'},description:{type:'STRING'},locationKey:{type:'STRING'},knownInitially:{type:'BOOLEAN'},requiresWarrant:{type:'BOOLEAN'},revealedByClueKeys:{type:'ARRAY',items:{type:'STRING'}},artifacts:{type:'ARRAY',items:artifactSchema}}"
);
src=src.replace(
  "required:['key','name','locationKey','angleDescription','hasAudio','clockOffsetSeconds','quality','status','knownInitially','events'],properties:{key:{type:'STRING'},name:{type:'STRING'},locationKey:{type:'STRING'},angleDescription:{type:'STRING'},hasAudio:{type:'BOOLEAN'},clockOffsetSeconds:{type:'INTEGER'},quality:{type:'STRING'},status:{type:'STRING'},knownInitially:{type:'BOOLEAN'},events:{type:'ARRAY',items:cameraEventSchema}}",
  "required:['key','name','locationKey','angleDescription','hasAudio','clockOffsetSeconds','quality','status','knownInitially','revealedByClueKeys','events'],properties:{key:{type:'STRING'},name:{type:'STRING'},locationKey:{type:'STRING'},angleDescription:{type:'STRING'},hasAudio:{type:'BOOLEAN'},clockOffsetSeconds:{type:'INTEGER'},quality:{type:'STRING'},status:{type:'STRING'},knownInitially:{type:'BOOLEAN'},revealedByClueKeys:{type:'ARRAY',items:{type:'STRING'}},events:{type:'ARRAY',items:cameraEventSchema}}"
);
src=src.replace(
  'knownInitially controla apenas se o objeto é conhecido no início, não altera sua existência. Tudo deve ser coerente com a cronologia e solução.',
  'knownInitially controla apenas se o objeto é conhecido no início, não altera sua existência. Em cada location, clueKeys deve listar SOMENTE keys de pistas que podem ser encontradas fisicamente naquele local. Cada device deve ter locationKey real e revealedByClueKeys; cada câmera também pode ser revelada por pistas em revealedByClueKeys. Use apenas clue keys existentes. Tudo deve ser coerente com a cronologia e solução.'
);

// Completa o caso legado com ligações físicas sem alterar sua solução.
if(fs.existsSync('lib/case.ts')){
  let c=fs.readFileSync('lib/case.ts','utf8');
  c=c.replace('export type WorldLocation={key:string;name:string;kind:string;description:string;x:number;y:number;knownInitially:boolean};','export type WorldLocation={key:string;name:string;kind:string;description:string;x:number;y:number;knownInitially:boolean;clueKeys?:string[]};');
  c=c.replace('export type WorldDevice={key:string;ownerCharacterId:string;type:string;label:string;description:string;knownInitially:boolean;requiresWarrant:boolean;artifacts:WorldArtifact[]};','export type WorldDevice={key:string;ownerCharacterId:string;type:string;label:string;description:string;locationKey?:string;knownInitially:boolean;requiresWarrant:boolean;revealedByClueKeys?:string[];artifacts:WorldArtifact[]};');
  c=c.replace('export type WorldCamera={key:string;name:string;locationKey:string;angleDescription:string;hasAudio:boolean;clockOffsetSeconds:number;quality:string;status:string;knownInitially:boolean;events:WorldCameraEvent[]};','export type WorldCamera={key:string;name:string;locationKey:string;angleDescription:string;hasAudio:boolean;clockOffsetSeconds:number;quality:string;status:string;knownInitially:boolean;revealedByClueKeys?:string[];events:WorldCameraEvent[]};');
  const locationLinks={
    "knownInitially:true},\n    {key:'quarto-1209'":"knownInitially:true,clueKeys:['camera']},\n    {key:'quarto-1209'",
    "knownInitially:true},\n    {key:'quarto-1207'":"knownInitially:true,clueKeys:['door','witness','drive']},\n    {key:'quarto-1207'",
    "knownInitially:true},\n    {key:'recepcao'":"knownInitially:true,clueKeys:['call','door']},\n    {key:'recepcao'",
    "knownInitially:true},\n    {key:'estacionamento'":"knownInitially:true,clueKeys:['camera','payment']},\n    {key:'estacionamento'"
  };
  for(const [a,b] of Object.entries(locationLinks))c=c.replace(a,b);
  c=c.replace("description:'Entrada e saída de hóspedes e visitantes.',x:18,y:78,knownInitially:true}","description:'Entrada e saída de hóspedes e visitantes.',x:18,y:78,knownInitially:true,clueKeys:[]}");
  c=c.replace("description:'Aparelho pessoal de Rafael.',knownInitially:true,requiresWarrant:true","description:'Aparelho pessoal de Rafael.',locationKey:'quarto-1207',knownInitially:true,requiresWarrant:true,revealedByClueKeys:[]");
  c=c.replace("description:'Estação usada para administrar câmeras e acessos.',knownInitially:true,requiresWarrant:false","description:'Estação usada para administrar câmeras e acessos.',locationKey:'recepcao',knownInitially:true,requiresWarrant:false,revealedByClueKeys:[]");
  c=c.replace("description:'Dispositivo localizado na base de um abajur da suíte 1209.',knownInitially:false,requiresWarrant:false","description:'Dispositivo localizado na base de um abajur da suíte 1209.',locationKey:'quarto-1209',knownInitially:false,requiresWarrant:false,revealedByClueKeys:['drive']");
  c=c.replace("status:'online',knownInitially:true,events:[","status:'online',knownInitially:true,revealedByClueKeys:[],events:[");
  fs.writeFileSync('lib/case.ts',c,'utf8');
}

// Evita que rotas de IA dependam do limite padrão curto quando o bundle restaurado não exporta duração.
for(const route of ['app/api/settings/route.ts','app/api/messages/route.ts']){
  if(!fs.existsSync(route)) continue;
  let r=fs.readFileSync(route,'utf8');
  if(!r.includes('export const maxDuration')) r='export const maxDuration = 60;\n'+r;
  fs.writeFileSync(route,r,'utf8');
}

fs.writeFileSync(file,src,'utf8');
console.log('Gemini 3.6 Flash: retry dentro de 60s, mundo ligado a pistas e JSON robusto.');
