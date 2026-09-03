import fs from 'node:fs';

const file='lib/gemini.ts';
let src=fs.readFileSync(file,'utf8');
const start=src.indexOf('function toJsonSchema');
const end=src.indexOf('const artifactSchema=');
if(start<0||end<0||end<=start) throw new Error('Bloco generate do Gemini não encontrado para patch.');
const replacement=`async function generate(apiKey:string,systemInstruction:string,input:string,maxOutputTokens:number,responseSchema?:object,_legacyTemperature?:number){
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
    method:'POST',
    headers:{'x-goog-api-key':apiKey,'Content-Type':'application/json'},
    signal:AbortSignal.timeout(55000),
    body:JSON.stringify({
      model:'gemini-3.6-flash',
      input,
      system_instruction:systemInstruction,
      store:false,
      generation_config:{max_output_tokens:maxOutputTokens,thinking_level:'medium',thinking_summaries:'none'}
    })
  });
  const raw=await response.text();
  let data:any=null;
  try{data=raw?JSON.parse(raw):null}catch{}
  if(!response.ok){
    const message=data?.error?.message||data?.message||raw||\`Falha do Gemini (\${response.status}).\`;
    throw new Error(message);
  }
  if(data?.status==='failed') throw new Error(data?.errors?.map((e:any)=>e.message).filter(Boolean).join('; ')||'A interação do Gemini falhou.');
  const text=(data?.steps||[])
    .filter((step:any)=>step?.type==='model_output')
    .flatMap((step:any)=>step.content||[])
    .filter((part:any)=>part?.type==='text')
    .map((part:any)=>part.text||'')
    .join('')
    .trim();
  if(!text) throw new Error('O Gemini devolveu uma resposta vazia.');
  const cleaned=text.replace(/^\\s*\`\`\`(?:json)?\\s*/i,'').replace(/\\s*\`\`\`\\s*$/,'').trim();
  try{return JSON.parse(cleaned)}catch{
    throw new Error('O Gemini respondeu, mas não devolveu o JSON esperado. Tente novamente.');
  }
}

`;
src=src.slice(0,start)+replacement+src.slice(end);
fs.writeFileSync(file,src,'utf8');
console.log('Payload Gemini Interactions corrigido para formato mínimo oficial.');
