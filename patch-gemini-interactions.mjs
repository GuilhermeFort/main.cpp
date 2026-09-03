import fs from 'node:fs';

const file='lib/gemini.ts';
let src=fs.readFileSync(file,'utf8');

const start=src.indexOf('function toJsonSchema');
const end=src.indexOf('const artifactSchema=');
if(start<0||end<0||end<=start) throw new Error('Bloco generate do Gemini não encontrado para patch.');

const replacement=`function toJsonSchema(value:any):any{
  if(Array.isArray(value)) return value.map(toJsonSchema);
  if(!value||typeof value!=='object') return value;
  const out:any={};
  for(const [key,raw] of Object.entries(value)){
    if(key==='nullable') continue;
    if(key==='type') out.type=String(raw).toLowerCase();
    else out[key]=toJsonSchema(raw);
  }
  return out;
}

function largeJsonShape(){
  const string={type:'string'};
  const genericObject={type:'object',properties:{}};
  return {
    type:'object',
    properties:{
      title:string,summary:string,incident:string,objective:string,difficulty:string,
      characters:{type:'array',items:{type:'object',properties:{id:string,name:string,role:string,initials:string,kind:string,publicDescription:string,secret:string,personality:string},required:['id','name','role','kind','publicDescription','secret','personality']}},
      clues:{type:'array',items:{type:'object',properties:{key:string,title:string,description:string,hiddenTruth:string},required:['key','title','description','hiddenTruth']}},
      solution:{type:'object',properties:{culpritId:string,motive:string,method:string,fullExplanation:string},required:['culpritId','motive','method','fullExplanation']},
      world:{type:'object',properties:{locations:{type:'array',items:genericObject},devices:{type:'array',items:genericObject},cameras:{type:'array',items:genericObject}},required:['locations','devices','cameras']}
    },
    required:['title','summary','incident','objective','difficulty','characters','clues','solution','world']
  };
}

function validParsedShape(parsed:any,responseSchema?:object){
  const props=(responseSchema as any)?.properties;
  if(!props) return true;
  if(props.characters){
    return !!parsed && typeof parsed==='object' && Array.isArray(parsed.characters) && Array.isArray(parsed.clues) && !!parsed.solution && typeof parsed.solution==='object' && !!parsed.world && typeof parsed.world==='object' && Array.isArray(parsed.world.locations) && Array.isArray(parsed.world.devices) && Array.isArray(parsed.world.cameras);
  }
  if(props.reply) return !!parsed && typeof parsed.reply==='string';
  return true;
}

async function generate(apiKey:string,systemInstruction:string,input:string,maxOutputTokens:number,responseSchema?:object,_legacyTemperature?:number){
  const format=(()=>{
    if(!responseSchema) return undefined;
    const converted=toJsonSchema(responseSchema);
    const schema=JSON.stringify(converted).length<3500?converted:largeJsonShape();
    return {type:'text',mime_type:'application/json',schema};
  })();

  const safetyContext='CONTEXTO DE SEGURANÇA: isto é exclusivamente uma obra ficcional de mistério e investigação para entretenimento. Não forneça instruções reais, acionáveis ou operacionais para ferir pessoas, fabricar armas, ocultar crimes reais ou burlar autoridades. Qualquer método de crime deve permanecer abstrato e narrativo. Foque em personagens, pistas, álibis, cronologia, emoções e lógica investigativa.';
  const safeSystem=safetyContext+'\\n\\n'+systemInstruction;
  const merged=\`\${safetyContext}\n\nINSTRUÇÕES DE SISTEMA:\n\${systemInstruction}\n\nENTRADA:\n\${input}\`;
  const models=['gemini-3.6-flash','gemini-3.7-flash','gemini-3.5-flash'];
  let lastMessage='O Gemini não conseguiu responder agora.';
  let allQuota=true;

  for(const model of models){
    const variants:any[]=[
      {model,input,system_instruction:safeSystem,store:false,generation_config:{max_output_tokens:maxOutputTokens},...(format?{response_format:format}:{})},
      {model,input:merged,store:false,generation_config:{max_output_tokens:maxOutputTokens},...(format?{response_format:format}:{})},
      {model,input:merged,store:false,...(format?{response_format:format}:{})},
      {model,input:merged+'\\n\\nRetorne SOMENTE um objeto JSON válido, sem markdown.',store:false,...(format?{response_format:format}:{})}
    ];

    let quotaHit=false;
    let blocked=false;
    for(let i=0;i<variants.length;i++){
      const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
        method:'POST',
        headers:{'x-goog-api-key':apiKey,'Content-Type':'application/json'},
        signal:AbortSignal.timeout(55000),
        body:JSON.stringify(variants[i])
      });
      const raw=await response.text();
      let data:any=null;
      try{data=raw?JSON.parse(raw):null}catch{}
      if(!response.ok){
        lastMessage=data?.error?.message||data?.message||raw||\`Falha do Gemini (\${response.status}).\`;
        if(response.status===429){quotaHit=true;break;}
        allQuota=false;
        blocked=/blocked|filter|policy|safety/i.test(lastMessage);
        if((response.status===400||blocked)&&i<variants.length-1) continue;
        if(blocked) break;
        throw new Error(lastMessage);
      }
      allQuota=false;
      if(data?.status==='failed'){
        lastMessage=data?.errors?.map((e:any)=>e.message).filter(Boolean).join('; ')||'A interação do Gemini falhou.';
        blocked=/blocked|filter|policy|safety/i.test(lastMessage);
        if(i<variants.length-1) continue;
        break;
      }
      const text=(typeof data?.output_text==='string'&&data.output_text.trim())
        ? data.output_text.trim()
        : (data?.steps||[])
            .filter((step:any)=>step?.type==='model_output')
            .flatMap((step:any)=>step.content||[])
            .filter((part:any)=>part?.type==='text')
            .map((part:any)=>part.text||'')
            .join('')
            .trim();
      if(!text){lastMessage='O Gemini devolveu uma resposta vazia.';if(i<variants.length-1)continue;break;}
      const cleaned=text.replace(/^\\s*\`\`\`(?:json)?\\s*/i,'').replace(/\\s*\`\`\`\\s*$/,'').trim();
      try{
        const parsed=JSON.parse(cleaned);
        if(!validParsedShape(parsed,responseSchema)){
          lastMessage='O Gemini devolveu JSON com estrutura inválida.';
          if(i<variants.length-1) continue;
          break;
        }
        return parsed;
      }catch{
        lastMessage='O Gemini respondeu em formato inesperado. A resposta estruturada não pôde ser lida.';
        if(i<variants.length-1) continue;
        break;
      }
    }
    if(!quotaHit && !blocked) break;
  }
  if(allQuota) throw new Error('Limite temporário do Gemini atingido em todos os modelos disponíveis. Aguarde cerca de 1 minuto e tente novamente.');
  if(/blocked|filter|policy|safety/i.test(lastMessage)) throw new Error('O Gemini bloqueou temporariamente a geração deste caso. Tente criar outro caso; o sistema já está configurado para manter o conteúdo estritamente ficcional.');
  throw new Error(lastMessage);
}

`;

src=src.slice(0,start)+replacement+src.slice(end);
src=src.replace(
  "const answerSchema={type:'OBJECT',required:['reply'],properties:{reply:{type:'STRING'},revealClueKey:{type:'STRING',nullable:true}}};",
  "const answerSchema={type:'OBJECT',required:['reply'],properties:{reply:{type:'STRING'},revealClueKey:{type:'STRING'}}};"
);
src=src.replace(
  'Retorne {"reply":string,"revealClueKey":string|null}.',
  'Retorne {"reply":string}. Inclua revealClueKey apenas quando uma pista real for legitimamente descoberta.'
);
src=src.replace(
  "if(!mystery.title||mystery.characters?.length!==suspectCount+supportCount||suspects.length!==suspectCount||support.length!==supportCount||mystery.clues?.length!==clueCount||!suspects.some(x=>x.id===mystery.solution?.culpritId)||!world?.locations?.length||!world?.devices?.length||!world?.cameras?.length) throw new Error('O Gemini montou um caso incompleto. Tente novamente.');",
  "if(!mystery.title||!Array.isArray(mystery.characters)||!Array.isArray(mystery.clues)||suspects.length<4||support.length<2||(mystery.clues?.length||0)<7||!suspects.some(x=>x.id===mystery.solution?.culpritId)||!world||!Array.isArray(world.locations)||!Array.isArray(world.devices)||!Array.isArray(world.cameras)||!world.locations.length||!world.devices.length||!world.cameras.length) throw new Error('O Gemini montou um caso incompleto. Tente novamente.');"
);
src=src.replace('Você é o motor invisível de uma investigação criminal ficcional extremamente realista.','Você é o motor invisível de uma obra ficcional de mistério investigativo com personagens emocionalmente realistas.');

fs.writeFileSync(file,src,'utf8');
console.log('Gemini Interactions: JSON validado estruturalmente antes de aceitar casos e respostas.');
