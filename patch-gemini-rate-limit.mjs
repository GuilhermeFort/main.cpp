import fs from 'node:fs';

const file='lib/gemini.ts';
if(!fs.existsSync(file)) throw new Error('lib/gemini.ts não encontrado.');
let src=fs.readFileSync(file,'utf8');

// Conversas curtas ganham retries próprios; casos grandes já possuem retry por truncamento.
src=src.replace('const attempts=isLargeCase?2:1;','const attempts=isLargeCase?2:3;');

const old="if(!response.ok)throw new Error(data?.error?.message||data?.message||raw||`Falha do Gemini (${response.status}).`);";
const replacement=`if(!response.ok){
        const message=String(data?.error?.message||data?.message||raw||\`Falha do Gemini (\${response.status}).\`);
        if(response.status===429){
          const retryHeader=response.headers.get('retry-after');
          const retryMatch=message.match(/retry in\\s+([0-9.]+)s/i);
          const retrySeconds=retryHeader?Number(retryHeader):(retryMatch?Number(retryMatch[1]):NaN);
          const waitMs=Number.isFinite(retrySeconds)?Math.min(Math.max(Math.ceil(retrySeconds*1000),1000),12000):Math.min(1500*Math.pow(2,attempt),6000);
          const isDaily=/per day|daily|RPD|quota.*day/i.test(message) && !/retry in\\s+[0-9.]+s/i.test(message);
          if(!isDaily && attempt+1<attempts){
            console.warn('Gemini rate limit; retry agendado',{attempt:attempt+1,waitMs});
            await new Promise(resolve=>setTimeout(resolve,waitMs));
            lastError=new Error('Gemini temporariamente no limite de requisições.');
            continue;
          }
          throw new Error(isDaily?'A cota diária do Gemini foi atingida. Tente novamente após a renovação da cota.':'O Gemini está temporariamente no limite de requisições. Aguarde alguns segundos e tente novamente.');
        }
        if((response.status===500||response.status===503||response.status===504) && attempt+1<attempts){
          await new Promise(resolve=>setTimeout(resolve,Math.min(1000*Math.pow(2,attempt),4000)));
          lastError=new Error(message);
          continue;
        }
        throw new Error(message);
      }`;

if(src.includes(old)) src=src.replace(old,replacement);
else if(!src.includes('Gemini rate limit; retry agendado')) throw new Error('Trecho de erro do Gemini mudou; patch de quota não aplicado.');

fs.writeFileSync(file,src,'utf8');
console.log('Gemini: tratamento de 429, Retry-After, backoff e mensagens amigáveis aplicado.');
