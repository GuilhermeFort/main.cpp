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
  const payload:any={
    model:'gemini-3.6-flash',
    input,
    system_instruction:systemInstruction,
    store:false,
    generation_config:{max_output_tokens:maxOutputTokens}
  };
  if(responseSchema){
    payload.response_format={
      type:'text',
      mime_type:'application/json',
      schema:toJsonSchema(responseSchema)
    };
  }

  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
    method:'POST',
    headers:{'x-goog-api-key':apiKey,'Content-Type':'application/json'},
    signal:AbortSignal.timeout(55000),
    body:JSON.stringify(payload)
  });
  const raw=await response.text();
  let data:any=null;
  try{data=raw?JSON.parse(raw):null}catch{}
  if(!response.ok){
    const message=data?.error?.message||data?.message||raw||\`Falha do Gemini (\${response.status}).\`;
    throw new Error(message);
  }
  if(data?.status==='failed') throw new Error(data?.errors?.map((e:any)=>e.message).filter(Boolean).join('; ')||'A interação do Gemini falhou.');
  const text=(typeof data?.output_text==='string'&&data.output_text.trim())
    ? data.output_text.trim()
    : (data?.steps||[])
        .filter((step:any)=>step?.type==='model_output')
        .flatMap((step:any)=>step.content||[])
        .filter((part:any)=>part?.type==='text')
        .map((part:any)=>part.text||'')
        .join('')
        .trim();
  if(!text) throw new Error('O Gemini devolveu uma resposta vazia.');
  const cleaned=text.replace(/^\\s*\`\`\`(?:json)?\\s*/i,'').replace(/\\s*\`\`\`\\s*$/,'').trim();
  try{return JSON.parse(cleaned)}catch{
    console.error('Gemini structured-output parse failure:',cleaned.slice(0,500));
    throw new Error('O Gemini respondeu em formato inesperado. A resposta estruturada não pôde ser lida.');
  }
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
console.log('Gemini Interactions: response_format objeto verificado e parser output_text corrigidos.');
