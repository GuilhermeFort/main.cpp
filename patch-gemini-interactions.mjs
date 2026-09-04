import fs from 'node:fs';

const file='lib/gemini.ts';
let src=fs.readFileSync(file,'utf8');

const start=src.indexOf('function toJsonSchema');
const end=src.indexOf('const artifactSchema=');
if(start<0||end<0||end<=start) throw new Error('Bloco generate do Gemini não encontrado para patch.');

const replacement=`async function generate(apiKey:string,systemInstruction:string,input:string,maxOutputTokens:number,responseSchema?:object,_legacyTemperature?:number){
  const isLargeCase=!!(responseSchema as any)?.properties?.characters;
  const tokenLimit=isLargeCase?Math.max(maxOutputTokens,26000):maxOutputTokens;

  async function call(limit:number){
    const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',{
      method:'POST',
      headers:{'x-goog-api-key':apiKey,'Content-Type':'application/json'},
      signal:AbortSignal.timeout(isLargeCase?90000:55000),
      body:JSON.stringify({
        system_instruction:{parts:[{text:systemInstruction}]},
        contents:[{role:'user',parts:[{text:input}]}],
        generationConfig:{
          maxOutputTokens:limit,
          responseMimeType:'application/json',
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
    return {text,finishReason};
  }

  let result=await call(tokenLimit);
  if(isLargeCase && (/MAX_TOKENS|LENGTH/i.test(result.finishReason)||(!result.text.endsWith('}')&&result.text.length>1000))){
    console.warn('Gemini case truncated; retrying with larger output budget.',result.finishReason,result.text.length);
    result=await call(Math.max(tokenLimit,36000));
  }

  if(!result.text) throw new Error('O Gemini devolveu uma resposta vazia.');
  const cleaned=result.text.replace(/^\\s*\`\`\`(?:json)?\\s*/i,'').replace(/\\s*\`\`\`\\s*$/,'').trim();
  try{return JSON.parse(cleaned)}catch{
    console.error('Gemini JSON parse failure:',{finishReason:result.finishReason,length:cleaned.length,start:cleaned.slice(0,250),end:cleaned.slice(-250)});
    if(isLargeCase) throw new Error('O Gemini cortou a geração do caso antes de terminar. Tente novamente.');
    throw new Error('O Gemini respondeu, mas o JSON não pôde ser lido.');
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
console.log('Gemini 3.6 Flash: limite ampliado e retry automático para casos truncados.');
