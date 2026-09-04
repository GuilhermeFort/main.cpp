import fs from 'node:fs';

const file='lib/gemini.ts';
if(!fs.existsSync(file)) throw new Error('lib/gemini.ts não encontrado.');
let src=fs.readFileSync(file,'utf8');

const start=src.indexOf("  const mystery=await generate(apiKey,system,");
const end=src.indexOf("  const suspects=mystery.characters", start);
if(start<0||end<0) throw new Error('generateMystery mudou; patch rápido não aplicado.');

const replacement=`  const coreSchema:any={...caseSchema,required:(caseSchema.required||[]).filter((x:string)=>x!=='world'),properties:{...(caseSchema as any).properties}};
  delete coreSchema.properties.world;
  const mystery=await generate(apiKey,system,
    \`Crie um caso totalmente inédito em português brasileiro usando a semente \${seed}. Dificuldade \${difficulty}. Varie crime, cidade, época, ambiente, vítima, método e motivo. Exatamente \${suspectCount} suspeitos e \${supportCount} personagens de apoio. Todo suspeito precisa ter motivo aparente, oportunidade aparente, mentira verificável e segredo secundário. O culpado deve ter álibi forte porém desmontável. Exatamente \${clueCount} pistas. Nenhuma pista isolada resolve o caso; pelo menos três precisam ser cruzadas; duas devem incriminar inocentes de forma plausível; uma envolve horário; uma depende de perícia. Seja compacto: publicDescription, personality, secret e hiddenTruth devem ser informativos mas curtos. IDs/keys minúsculos sem espaço. culpritId é um suspeito. NÃO gere world, locations, devices ou cameras.\`,
    specialist?5600:4800,coreSchema,.8) as any;

  const slug=(v:string)=>String(v||'item').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,42)||'item';
  const clues=(mystery.clues||[]) as any[];
  const suspectsForWorld=(mystery.characters||[]).filter((x:any)=>x.kind==='suspect');
  const locDefs=[['local-principal','Local principal','scene','Área central ligada ao incidente.'],['acesso','Área de acesso','access','Entradas, saídas e circulação do local.'],['administrativo','Área administrativa','office','Registros, documentos e infraestrutura institucional.'],['externo','Ponto externo','outside','Área externa relevante para deslocamentos e observação.'],['secundario','Local secundário','secondary','Local associado às relações dos envolvidos.']];
  const locations=locDefs.map((d:any,i:number)=>({key:d[0],name:d[1],kind:d[2],description:d[3],x:12+i*18,y:20+(i%2)*48,knownInitially:true,clueKeys:clues.filter((_:any,j:number)=>j%locDefs.length===i).map((c:any)=>c.key)}));
  const devices=suspectsForWorld.slice(0,Math.min(4,suspectsForWorld.length)).map((s:any,i:number)=>{const assigned=clues.filter((_:any,j:number)=>j%Math.max(1,Math.min(4,suspectsForWorld.length))===i).slice(0,4);return {key:\`celular-\${slug(s.id||s.name)}\`,ownerCharacterId:s.id,type:'phone',label:\`Celular de \${s.name}\`,description:\`Aparelho pessoal atribuído a \${s.name}.\`,locationKey:i%2?'secundario':'acesso',knownInitially:true,requiresWarrant:i!==0,revealedByClueKeys:[],artifacts:assigned.map((c:any,j:number)=>({key:\`art-\${slug(c.key)}\`,type:j%3===0?'message':j%3===1?'location':'call',title:\`Registro: \${c.title}\`,content:\`Registro digital compatível com a linha investigativa: \${c.description}\`,minuteLabel:j%2===0?'horário aproximado':'sem horário conclusivo',source:\`\${s.name} / dispositivo\`,reliability:72+((i+j)%4)*7}))};});
  devices.push({key:'terminal-institucional',ownerCharacterId:'',type:'computer',label:'Terminal institucional',description:'Equipamento usado para registros administrativos e acessos.',locationKey:'administrativo',knownInitially:true,requiresWarrant:false,revealedByClueKeys:[],artifacts:clues.slice(-3).map((c:any,j:number)=>({key:\`sys-\${slug(c.key)}\`,type:j%2?'log':'document',title:\`Registro institucional: \${c.title}\`,content:\`O sistema contém referência a: \${c.description}\`,minuteLabel:'registro do período investigado',source:'sistema institucional',reliability:88}))});
  const cameras=[0,1,2].map((i:number)=>({key:\`camera-\${i+1}\`,name:\`Câmera \${i+1}\`,locationKey:locations[i+1]?.key||locations[0].key,angleDescription:i===0?'Cobre entradas e circulação principal.':i===1?'Cobre parcialmente a área, com ponto cego lateral.':'Cobre somente deslocamentos externos; detalhes faciais são limitados.',hasAudio:false,clockOffsetSeconds:i===1?47:0,quality:i===2?'baixa':'média',status:'online',knownInitially:true,revealedByClueKeys:[],events:clues.filter((_:any,j:number)=>j%3===i).slice(0,3).map((c:any,j:number)=>({key:\`cam-\${i+1}-\${slug(c.key)}\`,minuteLabel:j===0?'janela relevante':'horário aproximado',description:\`A gravação mostra elementos compatíveis com: \${c.description}\`,visibleDetails:j===0?'Movimentação parcial; não permite concluir autoria isoladamente.':'Detalhes limitados pelo ângulo e qualidade da câmera.',confidence:68+i*8+j*4}))}));
  mystery.world={locations,devices,cameras};
`;

src=src.slice(0,start)+replacement+src.slice(end);
src=src.replace("const suspects=mystery.characters?.filter(x=>x.kind==='suspect')||[], support=mystery.characters?.filter(x=>x.kind!=='suspect')||[], world=(mystery as any).world;","const suspects=(mystery.characters||[]).filter((x:any)=>x.kind==='suspect'), support=(mystery.characters||[]).filter((x:any)=>x.kind!=='suspect'), world=(mystery as any).world;");
src=src.replace("suspects.some(x=>x.id===mystery.solution?.culpritId)","suspects.some((x:any)=>x.id===mystery.solution?.culpritId)");
src=src.replace("specialist?7600:6500,caseSchema,.8","specialist?5600:4800,coreSchema,.8");
fs.writeFileSync(file,src,'utf8');
console.log('Gemini: núcleo compacto + mundo derivado no servidor aplicado.');
