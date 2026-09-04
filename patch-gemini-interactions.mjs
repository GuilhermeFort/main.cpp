import fs from 'node:fs';

const file='lib/gemini.ts';
let src=fs.readFileSync(file,'utf8');

const start=src.indexOf('function toJsonSchema');
const end=src.indexOf('const artifactSchema=');
if(start<0||end<0||end<=start) throw new Error('Bloco generate do Gemini não encontrado para patch.');

const replacement=`async function generate(apiKey:string,systemInstruction:string,input:string,maxOutputTokens:number,responseSchema?:object,_legacyTemperature?:number){
  const isLargeCase=!!(responseSchema as any)?.properties?.characters;
  // Caso grande precisa caber na janela curta da Function. Uma chamada compacta e rápida
  // é mais confiável do que duas chamadas que somadas estouram maxDuration.
  const tokenLimit=isLargeCase?10000:Math.max(maxOutputTokens,1200);
  const attempts=isLargeCase?1:1;
  let lastError:any=null;

  for(let attempt=0;attempt<attempts;attempt++){
    const controller=new AbortController();
    const timeoutMs=isLargeCase?50000:28000;
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const compactHint=isLargeCase?'\\nRESPONDA DE FORMA COMPACTA. Preserve TODOS os campos obrigatórios, mas mantenha textos internos curtos para concluir o JSON dentro do tempo disponível. Não use markdown.':'';
      const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',{
        method:'POST',
        headers:{'x-goog-api-key':apiKey,'Content-Type':'application/json','X-Server-Timeout':'48'},
        signal:controller.signal,
        body:JSON.stringify({system_instruction:{parts:[{text:systemInstruction}]},contents:[{role:'user',parts:[{text:input+compactHint}]}],generationConfig:{maxOutputTokens:tokenLimit,responseMimeType:'application/json',thinkingConfig:{thinkingLevel:'MINIMAL'},...(responseSchema?{responseSchema}:{})}})
      });
      const raw=await response.text();let data:any=null;try{data=raw?JSON.parse(raw):null}catch{}
      if(!response.ok)throw new Error(data?.error?.message||data?.message||raw||\`Falha do Gemini (\${response.status}).\`);
      const candidate=data?.candidates?.[0];const text=(candidate?.content?.parts||[]).map((part:any)=>part?.text||'').join('').trim();const finishReason=String(candidate?.finishReason||'');
      if(!text)throw new Error('O Gemini devolveu uma resposta vazia.');
      const cleaned=text.replace(/^\\s*\`\`\`(?:json)?\\s*/i,'').replace(/\\s*\`\`\`\\s*$/,'').trim();
      try{return JSON.parse(cleaned)}catch{const truncated=/MAX_TOKENS|LENGTH/i.test(finishReason)||(!cleaned.endsWith('}')&&!cleaned.endsWith(']'));console.error('Gemini JSON parse failure:',{attempt,finishReason,length:cleaned.length,start:cleaned.slice(0,160),end:cleaned.slice(-160)});throw new Error(truncated?'A geração do caso foi cortada antes de terminar. Tente gerar novamente.':'O Gemini respondeu, mas o JSON não pôde ser lido.');}
    }catch(error:any){lastError=error;if(error?.name==='AbortError')throw new Error('O Gemini demorou demais para gerar o caso. Tente novamente.');throw error;}finally{clearTimeout(timer);}
  }
  throw lastError||new Error('O Gemini não conseguiu concluir a geração.');
}

`;

src=src.slice(0,start)+replacement+src.slice(end);
src=src.replace("const answerSchema={type:'OBJECT',required:['reply'],properties:{reply:{type:'STRING'},revealClueKey:{type:'STRING',nullable:true}}};","const answerSchema={type:'OBJECT',required:['reply'],properties:{reply:{type:'STRING'},revealClueKey:{type:'STRING'}}};");
src=src.replace('Retorne {\"reply\":string,\"revealClueKey\":string|null}.','Retorne {\"reply\":string}. Inclua revealClueKey apenas quando uma pista real for legitimamente descoberta.');

src=src.replace("required:['key','name','kind','description','x','y','knownInitially'],properties:{key:{type:'STRING'},name:{type:'STRING'},kind:{type:'STRING'},description:{type:'STRING'},x:{type:'INTEGER'},y:{type:'INTEGER'},knownInitially:{type:'BOOLEAN'}}","required:['key','name','kind','description','x','y','knownInitially','clueKeys'],properties:{key:{type:'STRING'},name:{type:'STRING'},kind:{type:'STRING'},description:{type:'STRING'},x:{type:'INTEGER'},y:{type:'INTEGER'},knownInitially:{type:'BOOLEAN'},clueKeys:{type:'ARRAY',items:{type:'STRING'}}}");
src=src.replace("required:['key','ownerCharacterId','type','label','description','knownInitially','requiresWarrant','artifacts'],properties:{key:{type:'STRING'},ownerCharacterId:{type:'STRING'},type:{type:'STRING'},label:{type:'STRING'},description:{type:'STRING'},knownInitially:{type:'BOOLEAN'},requiresWarrant:{type:'BOOLEAN'},artifacts:{type:'ARRAY',items:artifactSchema}}","required:['key','ownerCharacterId','type','label','description','locationKey','knownInitially','requiresWarrant','revealedByClueKeys','artifacts'],properties:{key:{type:'STRING'},ownerCharacterId:{type:'STRING'},type:{type:'STRING'},label:{type:'STRING'},description:{type:'STRING'},locationKey:{type:'STRING'},knownInitially:{type:'BOOLEAN'},requiresWarrant:{type:'BOOLEAN'},revealedByClueKeys:{type:'ARRAY',items:{type:'STRING'}},artifacts:{type:'ARRAY',items:artifactSchema}}");
src=src.replace("required:['key','name','locationKey','angleDescription','hasAudio','clockOffsetSeconds','quality','status','knownInitially','events'],properties:{key:{type:'STRING'},name:{type:'STRING'},locationKey:{type:'STRING'},angleDescription:{type:'STRING'},hasAudio:{type:'BOOLEAN'},clockOffsetSeconds:{type:'INTEGER'},quality:{type:'STRING'},status:{type:'STRING'},knownInitially:{type:'BOOLEAN'},events:{type:'ARRAY',items:cameraEventSchema}}","required:['key','name','locationKey','angleDescription','hasAudio','clockOffsetSeconds','quality','status','knownInitially','revealedByClueKeys','events'],properties:{key:{type:'STRING'},name:{type:'STRING'},locationKey:{type:'STRING'},angleDescription:{type:'STRING'},hasAudio:{type:'BOOLEAN'},clockOffsetSeconds:{type:'INTEGER'},quality:{type:'STRING'},status:{type:'STRING'},knownInitially:{type:'BOOLEAN'},revealedByClueKeys:{type:'ARRAY',items:{type:'STRING'}},events:{type:'ARRAY',items:cameraEventSchema}}");
src=src.replace('knownInitially controla apenas se o objeto é conhecido no início, não altera sua existência. Tudo deve ser coerente com a cronologia e solução.','knownInitially controla apenas se o objeto é conhecido no início, não altera sua existência. Em cada location, clueKeys deve listar SOMENTE keys de pistas que podem ser encontradas fisicamente naquele local. Cada device deve ter locationKey real e revealedByClueKeys; cada câmera também pode ser revelada por pistas em revealedByClueKeys. Use apenas clue keys existentes. Tudo deve ser coerente com a cronologia e solução.');

if(fs.existsSync('lib/case.ts')){
  let c=fs.readFileSync('lib/case.ts','utf8');
  c=c.replace('export type WorldLocation={key:string;name:string;kind:string;description:string;x:number;y:number;knownInitially:boolean};','export type WorldLocation={key:string;name:string;kind:string;description:string;x:number;y:number;knownInitially:boolean;clueKeys?:string[]};');
  c=c.replace('export type WorldDevice={key:string;ownerCharacterId:string;type:string;label:string;description:string;knownInitially:boolean;requiresWarrant:boolean;artifacts:WorldArtifact[]};','export type WorldDevice={key:string;ownerCharacterId:string;type:string;label:string;description:string;locationKey?:string;knownInitially:boolean;requiresWarrant:boolean;revealedByClueKeys?:string[];artifacts:WorldArtifact[]};');
  c=c.replace('export type WorldCamera={key:string;name:string;locationKey:string;angleDescription:string;hasAudio:boolean;clockOffsetSeconds:number;quality:string;status:string;knownInitially:boolean;events:WorldCameraEvent[]};','export type WorldCamera={key:string;name:string;locationKey:string;angleDescription:string;hasAudio:boolean;clockOffsetSeconds:number;quality:string;status:string;knownInitially:boolean;revealedByClueKeys?:string[];events:WorldCameraEvent[]};');
  fs.writeFileSync('lib/case.ts',c,'utf8');
}

const worldRoute='app/api/world-state/route.ts';
if(fs.existsSync(worldRoute)){
  let w=fs.readFileSync(worldRoute,'utf8');
  w=w.replace("const uniq=<T,>(a:T[])=>Array.from(new Set(a));","const uniq=(a:any[]):string[]=>Array.from(new Set(a.map((x:any)=>String(x))));");
  fs.writeFileSync(worldRoute,w,'utf8');
}

for(const route of ['app/api/settings/route.ts','app/api/messages/route.ts']){
  if(!fs.existsSync(route))continue;let r=fs.readFileSync(route,'utf8');if(!r.includes('export const maxDuration'))r='export const maxDuration = 60;\n'+r;fs.writeFileSync(route,r,'utf8');
}

fs.writeFileSync(file,src,'utf8');
console.log('Gemini 3.6 Flash: geração compacta em uma chamada, timeout de 50s e JSON robusto.');
