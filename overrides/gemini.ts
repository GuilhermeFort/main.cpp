import type { MysteryCase } from './case';
type Difficulty='dificil'|'especialista';
const preferredModels=['gemini-2.5-flash','gemini-2.0-flash'];

async function generate(apiKey:string,systemInstruction:string,input:string,maxOutputTokens:number,responseSchema?:object,temperature=.7){
  let lastError='O Gemini não conseguiu responder agora.';
  for(const model of preferredModels){
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
      method:'POST',headers:{'x-goog-api-key':apiKey,'Content-Type':'application/json'},signal:AbortSignal.timeout(55000),
      body:JSON.stringify({systemInstruction:{parts:[{text:systemInstruction}]},contents:[{role:'user',parts:[{text:input}]}],generationConfig:{maxOutputTokens,temperature,responseMimeType:'application/json',...(responseSchema?{responseSchema}:{})}})
    });
    if(!response.ok){const detail=await response.json().catch(()=>null) as any;lastError=detail?.error?.message||`Falha do Gemini (${response.status}).`;if(response.status===404||response.status===400)continue;throw new Error(lastError)}
    const data=await response.json() as any;
    const text=data.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||'').join('').trim();
    if(!text)throw new Error('O Gemini devolveu uma resposta vazia.');
    try{return JSON.parse(text.replace(/^```json\s*|\s*```$/g,''))}catch{throw new Error('O Gemini não terminou de montar o caso.')}
  }
  throw new Error(lastError);
}

const artifactSchema={type:'OBJECT',required:['key','type','title','content','minuteLabel','source','reliability'],properties:{key:{type:'STRING'},type:{type:'STRING'},title:{type:'STRING'},content:{type:'STRING'},minuteLabel:{type:'STRING'},source:{type:'STRING'},reliability:{type:'INTEGER'}}};
const cameraEventSchema={type:'OBJECT',required:['key','minuteLabel','description','visibleDetails','confidence'],properties:{key:{type:'STRING'},minuteLabel:{type:'STRING'},description:{type:'STRING'},visibleDetails:{type:'STRING'},confidence:{type:'INTEGER'}}};
const worldSchema={type:'OBJECT',required:['locations','devices','cameras'],properties:{
  locations:{type:'ARRAY',items:{type:'OBJECT',required:['key','name','kind','description','x','y','knownInitially'],properties:{key:{type:'STRING'},name:{type:'STRING'},kind:{type:'STRING'},description:{type:'STRING'},x:{type:'INTEGER'},y:{type:'INTEGER'},knownInitially:{type:'BOOLEAN'}}}},
  devices:{type:'ARRAY',items:{type:'OBJECT',required:['key','ownerCharacterId','type','label','description','knownInitially','requiresWarrant','artifacts'],properties:{key:{type:'STRING'},ownerCharacterId:{type:'STRING'},type:{type:'STRING'},label:{type:'STRING'},description:{type:'STRING'},knownInitially:{type:'BOOLEAN'},requiresWarrant:{type:'BOOLEAN'},artifacts:{type:'ARRAY',items:artifactSchema}}}},
  cameras:{type:'ARRAY',items:{type:'OBJECT',required:['key','name','locationKey','angleDescription','hasAudio','clockOffsetSeconds','quality','status','knownInitially','events'],properties:{key:{type:'STRING'},name:{type:'STRING'},locationKey:{type:'STRING'},angleDescription:{type:'STRING'},hasAudio:{type:'BOOLEAN'},clockOffsetSeconds:{type:'INTEGER'},quality:{type:'STRING'},status:{type:'STRING'},knownInitially:{type:'BOOLEAN'},events:{type:'ARRAY',items:cameraEventSchema}}}}
}};
const caseSchema={type:'OBJECT',required:['title','summary','incident','objective','difficulty','characters','clues','solution','world'],properties:{title:{type:'STRING'},summary:{type:'STRING'},incident:{type:'STRING'},objective:{type:'STRING'},difficulty:{type:'STRING',enum:['dificil','especialista']},characters:{type:'ARRAY',items:{type:'OBJECT',required:['id','name','role','initials','kind','publicDescription','secret','personality'],properties:{id:{type:'STRING'},name:{type:'STRING'},role:{type:'STRING'},initials:{type:'STRING'},kind:{type:'STRING',enum:['official','suspect','witness','expert']},publicDescription:{type:'STRING'},secret:{type:'STRING'},personality:{type:'STRING'}}}},clues:{type:'ARRAY',items:{type:'OBJECT',required:['key','title','description','hiddenTruth'],properties:{key:{type:'STRING'},title:{type:'STRING'},description:{type:'STRING'},hiddenTruth:{type:'STRING'}}}},solution:{type:'OBJECT',required:['culpritId','motive','method','fullExplanation'],properties:{culpritId:{type:'STRING'},motive:{type:'STRING'},method:{type:'STRING'},fullExplanation:{type:'STRING'}}},world:worldSchema}};
const answerSchema={type:'OBJECT',required:['reply'],properties:{reply:{type:'STRING'},revealClueKey:{type:'STRING',nullable:true}}};

const CORE=`Você é o motor invisível de uma investigação criminal ficcional extremamente realista. Nunca diga que é IA, chatbot, narrador ou sistema. A verdade do caso é fixa e imutável. Uma afirmação do jogador NÃO vira fato. Nunca invente prova para confirmar a hipótese do detetive.

Cada personagem é uma pessoa independente com voz própria, idade, profissão, história, relação com a vítima, temperamento, medos, objetivos, ressentimentos, lealdades, segredos, limites de conhecimento e memória. Pessoas diferentes DEVEM falar diferente. Use respostas humanas: às vezes curtas, hesitantes, secas, sarcásticas, irritadas ou incompletas. Evite monólogos teatrais repetitivos.

Memória e emoção persistem no histórico. Acusação injusta pode gerar raiva; respeito pode gerar cooperação; prova verdadeira pode gerar medo ou desorganizar uma mentira; repetição pode gerar impaciência. Não resete o estado emocional a cada mensagem.

Conhecimento é limitado. Suspeito não conhece automaticamente laudos, conversas privadas ou provas ainda não mostradas. Testemunha separa o que viu do que ouviu e do que apenas acha. Perito separa certeza, compatibilidade e impossibilidade de determinar.

Mentiras têm motivo. Inocentes podem mentir para proteger vergonha, traição, dívida, carreira, outra pessoa ou crime secundário. Mentira não significa assassinato. Contradição pode ser erro de memória, confusão, omissão ou mentira deliberada.

Blefes são permitidos. Se o jogador afirma possuir uma prova que não consta entre as evidências oficialmente descobertas/apresentadas, trate isso como possível blefe. Nunca aceite automaticamente. Um personagem pode negar, pedir para ver o laudo, desafiar ou se preocupar conforme sua personalidade.

Pressão não é botão de confissão. Inocente jamais confessa o crime verdadeiro por pressão. Culpado protege álibi, mede o que a polícia sabe e só começa a admitir quando provas reais e contradições tornam a resistência psicologicamente plausível. Confissão, quando ocorrer, deve ser gradual: primeiro detalhe omitido, depois presença/mentira, depois fato comprometedor e só por fim participação criminal. Não despeje a solução inteira de uma vez.

Não entregue pista gratuitamente. Pergunta vaga recebe resposta vaga. Pista aparece por pergunta específica, busca, perícia, confronto ou cruzamento coerente. Nem toda busca encontra algo.

A Central é interface institucional, nunca pessoa. Ela não fica nervosa, não é suspeita e não fala como personagem. Só retorna diligências e resultados coerentes com a verdade do caso. Não inventa câmera, digital, compra, transferência, mensagem, confissão ou documento só porque o jogador pediu.

Mantenha UMA cronologia verdadeira. Não mude culpado, motivo, método, cúmplice, arma ou evidência estrutural durante a conversa. O jogador pode construir teoria errada e o mundo não deve corrigi-lo artificialmente.

Antes de responder, confira silenciosamente: quem fala; o que essa pessoa sabe; o que já disse; emoção atual; se a premissa do jogador é verdadeira; se a prova apresentada é real; se deve falar verdade, omitir, mentir, desviar ou se recusar; e se alguma pista pode legitimamente ser descoberta. Nunca mostre esse processo.`;

export async function generateMystery(apiKey:string,difficulty:Difficulty='dificil'):Promise<MysteryCase>{
  const seed=crypto.randomUUID(), specialist=difficulty==='especialista', suspectCount=specialist?6:5, supportCount=specialist?4:3, clueCount=specialist?12:9;
  const system=`${CORE}\nMODO CRIAÇÃO: antes de gerar personagens, fixe silenciosamente toda a verdade: crime, culpado, motivo, método, cronologia, oportunidade, erros do culpado, evidências reais, red herrings com explicação inocente e o que cada pessoa sabe. Depois crie os personagens ao redor dessa verdade. Em personality descreva de forma compacta o jeito de falar, formalidade, gírias, temperamento, estado emocional inicial, gatilhos, reação a pressão, relação com vítima e postura diante da polícia. Em secret descreva fatos privados, o que sabe, o que acha, o que não sabe, mentira planejada, segredo secundário e quais provas seriam necessárias para fazê-lo admitir cada camada. Nunca deixe esses campos genéricos.\n\nCrie também WORLD como a infraestrutura CANÔNICA e IMUTÁVEL do caso. Locations são locais relevantes com coordenadas x/y de 5 a 95 para um mapa abstrato. Devices são celulares/computadores/aparelhos reais do caso; artifacts são registros digitais que já existem desde o nascimento do caso. Cameras possuem limitações reais (ângulo, áudio, relógio, qualidade, status) e events que já aconteceram. Não crie nenhum artifact/event que sozinho entregue o culpado. Alguns registros devem ser irrelevantes ou ambíguos. ownerCharacterId deve usar ID real de personagem ou string vazia quando institucional. knownInitially controla apenas se o objeto é conhecido no início, não altera sua existência. Tudo deve ser coerente com a cronologia e solução.`;
  const mystery=await generate(apiKey,system,`Crie um caso totalmente inédito em português brasileiro usando a semente ${seed}. Dificuldade ${difficulty}. Varie crime, cidade, época, ambiente, vítima, método e motivo. Exatamente ${suspectCount} suspeitos e ${supportCount} personagens de apoio. Todo suspeito precisa ter motivo aparente, oportunidade aparente, mentira verificável e segredo secundário. O culpado deve ter álibi forte porém desmontável. Exatamente ${clueCount} pistas. Nenhuma pista isolada resolve o caso; pelo menos três precisam ser cruzadas; duas devem incriminar inocentes de forma plausível; uma envolve horário; uma depende de perícia. WORLD deve ter 5 a 8 locais, 3 a 6 dispositivos com 2 a 5 artifacts cada, e 3 a 6 câmeras com 1 a 5 events cada. Pelo menos um dispositivo exige autorização judicial e pelo menos uma câmera possui limitação real. IDs/keys minúsculos sem espaço. culpritId é um suspeito.`,specialist?7600:6500,caseSchema,.8) as MysteryCase;
  const suspects=mystery.characters?.filter(x=>x.kind==='suspect')||[], support=mystery.characters?.filter(x=>x.kind!=='suspect')||[], world=(mystery as any).world;
  if(!mystery.title||mystery.characters?.length!==suspectCount+supportCount||suspects.length!==suspectCount||support.length!==supportCount||mystery.clues?.length!==clueCount||!suspects.some(x=>x.id===mystery.solution?.culpritId)||!world?.locations?.length||!world?.devices?.length||!world?.cameras?.length) throw new Error('O Gemini montou um caso incompleto. Tente novamente.');
  mystery.difficulty=difficulty; return mystery;
}

function normalize(s:string){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()}

export async function answerMystery(apiKey:string,mystery:MysteryCase,target:string,history:string,discovered:string[],question:string){
  const character=mystery.characters.find(x=>x.id===target);
  const isCentral=target==='narrador';
  const discoveredClues=mystery.clues.filter(c=>discovered.includes(c.key));
  const marker='[EVIDÊNCIA APRESENTADA AO DEPOENTE]';
  let evidenceContext='Nenhuma evidência foi formalmente apresentada nesta mensagem.';
  if(question.includes(marker)){
    const shown=question.split(marker)[1]?.split('\n\n')[0]?.trim()||'';
    const n=normalize(shown);
    const valid=discoveredClues.find(c=>{
      const a=normalize(c.title), b=normalize(c.description);
      return n.includes(a)||a.includes(n)||n.includes(b.slice(0,Math.min(70,b.length)));
    });
    evidenceContext=valid
      ? `PROVA APRESENTADA E VALIDADA: ${valid.title} — ${valid.description}. Esta prova é real e oficialmente descoberta. O personagem deve reagir ao peso dela sem inventar consequências que ela não prova.`
      : `O jogador afirmou/apresentou uma suposta prova, mas ela NÃO pôde ser validada entre as pistas oficialmente descobertas. Trate como possível blefe; não a transforme em fato.`;
  }

  const role=isCentral
    ? `PAPEL: CENTRAL DE INVESTIGAÇÃO. Responda em tom operacional. Você pode executar buscas, cruzamentos, perícias e consultas plausíveis. Se não houver resultado canônico ou logicamente derivável, diga que nada conclusivo foi encontrado. Não dê opinião emocional e não assuma voz de suspeitos.`
    : `PAPEL: ${character?.name}, ${character?.role}, categoria ${character?.kind}. PERSONALIDADE FIXA: ${character?.personality}. SEGREDO/CONHECIMENTO PRIVADO FIXO: ${character?.secret}. Você fala somente como essa pessoa. Não usa conhecimento de outras conversas privadas. Responda diretamente à pergunta. Se estiver irritado, assustado, cansado ou desconfiado por causa do histórico, deixe isso aparecer naturalmente sem virar caricatura.`;

  const culprit=character?.id===mystery.solution.culpritId;
  const pressure=`STATUS DE PRESSÃO: ${discoveredClues.length} de ${mystery.clues.length} pistas oficiais já foram descobertas. ${culprit?'Este personagem É o culpado canônico; proteja a versão enquanto ainda houver explicação plausível, mas permita rachaduras graduais quando evidências reais destruírem seu álibi.':'Este personagem NÃO é o culpado canônico; jamais faça uma falsa confissão do crime principal.'}`;

  const system=`${CORE}\n\nVERDADE CANÔNICA DO CASO (secreta): ${JSON.stringify(mystery)}\n\n${role}\n${pressure}\n${evidenceContext}\n\nPistas oficialmente descobertas: ${JSON.stringify(discoveredClues)}\nRetorne apenas JSON no formato pedido.`;
  const input=`HISTÓRICO DESTA CONVERSA COM ESTE ALVO:\n${history||'sem histórico'}\n\nMENSAGEM ATUAL DO DETETIVE:\n${question}\n\nResponda como a pessoa/central em até 110 palavras. revealClueKey só pode ser uma key real ainda não descoberta e somente se a ação/pergunta realmente justificou a descoberta. Retorne {"reply":string,"revealClueKey":string|null}.`;
  const result=await generate(apiKey,system,input,560,answerSchema,.5) as any;
  if(!result.reply) throw new Error('Resposta incompleta do Gemini.');
  if(result.revealClueKey&&(discovered.includes(result.revealClueKey)||!mystery.clues.some(c=>c.key===result.revealClueKey))) result.revealClueKey=null;
  return result;
}
