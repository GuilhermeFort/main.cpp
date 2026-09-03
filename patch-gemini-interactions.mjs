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

async function generate(apiKey:string,systemInstruction:string,input:string,maxOutputTokens:number,responseSchema?:object,_legacyTemperature?:number){
  const format=(()=>{
    if(!responseSchema) return undefined;
    const converted=toJsonSchema(responseSchema);
    const f:any={type:'text',mime_type:'application/json'};
    if(JSON.stringify(converted).length<3500) f.schema=converted;
    return f;
  })();

  const merged=\`INSTRUÇÕES DE SISTEMA:\n\${systemInstruction}\n\nENTRADA:\n\${input}\`;
  const models=['gemini-3.6-flash','gemini-3.7-flash','gemini-3.5-flash'];
  let lastMessage='O Gemini não conseguiu responder agora.';
  let allQuota=true;

  for(const model of models){
    const variants:any[]=[
      {model,input,system_instruction:systemInstruction,store:false,generation_config:{max_output_tokens:maxOutputTokens},...(format?{response_format:format}:{})},
      {model,input:merged,store:false,generation_config:{max_output_tokens:maxOutputTokens},...(format?{response_format:format}:{})},
      {model,input:merged,store:false,...(format?{response_format:format}:{})},
      {model,input:merged+'\\n\\nRetorne SOMENTE um objeto JSON válido, sem markdown.',store:false}
    ];

    let quotaHit=false;
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
        if(response.status===400&&i<variants.length-1) continue;
        throw new Error(lastMessage);
      }
      allQuota=false;
      if(data?.status==='failed'){
        lastMessage=data?.errors?.map((e:any)=>e.message).filter(Boolean).join('; ')||'A interação do Gemini falhou.';
        if(i<variants.length-1) continue;
        throw new Error(lastMessage);
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
      if(!text){lastMessage='O Gemini devolveu uma resposta vazia.';if(i<variants.length-1)continue;throw new Error(lastMessage)}
      const cleaned=text.replace(/^\\s*\`\`\`(?:json)?\\s*/i,'').replace(/\\s*\`\`\`\\s*$/,'').trim();
      try{return JSON.parse(cleaned)}catch{
        lastMessage='O Gemini respondeu em formato inesperado. A resposta estruturada não pôde ser lida.';
        if(i<variants.length-1) continue;
        throw new Error(lastMessage);
      }
    }
    if(!quotaHit) break;
  }
  if(allQuota) throw new Error('Limite temporário do Gemini atingido em todos os modelos disponíveis. Aguarde cerca de 1 minuto e tente novamente.');
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

fs.writeFileSync(file,src,'utf8');
console.log('Gemini Interactions: 3.6 principal, 3.7 e 3.5 fallbacks em quota.');
