import fs from 'node:fs';

const file='lib/gemini.ts';
let src=fs.readFileSync(file,'utf8');

const start=src.indexOf('function toJsonSchema');
const end=src.indexOf('const artifactSchema=');
if(start<0||end<0||end<=start) throw new Error('Bloco generate do Gemini não encontrado para patch.');

const replacement=`async function generate(apiKey:string,systemInstruction:string,input:string,maxOutputTokens:number,responseSchema?:object,_legacyTemperature?:number){
  const isLargeCase=!!(responseSchema as any)?.properties?.characters;
  const tokenLimit=isLargeCase?16000:Math.max(maxOutputTokens,1200);
  const attempts=isLargeCase?2:1;
  let lastError:any=null;

  for(let attempt=0;attempt<attempts;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),isLargeCase?50000:28000);
    try{
      const compactHint=attempt===0?'':'\\nIMPORTANTE: a resposta anterior ficou grande demais. Seja mais conciso em descrições, segredos e artefatos, sem remover nenhum campo obrigatório nem alterar quantidades.';
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

// Evita que rotas de IA dependam do limite padrão curto quando o bundle restaurado não exporta duração.
for(const route of ['app/api/settings/route.ts','app/api/messages/route.ts']){
  if(!fs.existsSync(route)) continue;
  let r=fs.readFileSync(route,'utf8');
  if(!r.includes('export const maxDuration')) r='export const maxDuration = 60;\n'+r;
  fs.writeFileSync(route,r,'utf8');
}

fs.writeFileSync(file,src,'utf8');
console.log('Gemini 3.6 Flash: retry compacto, timeout controlado e JSON robusto.');
