import type { MysteryCase } from './case';
type Difficulty='dificil'|'especialista';
const preferredModels=['gemini-2.5-flash','gemini-2.0-flash'];

async function generate(apiKey:string,systemInstruction:string,input:string,maxOutputTokens:number,responseSchema?:object,temperature=.82){
  let lastError='O Gemini não conseguiu responder agora.';
  for(const model of preferredModels){
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
      method:'POST',
      headers:{'x-goog-api-key':apiKey,'Content-Type':'application/json'},
      signal:AbortSignal.timeout(55000),
      body:JSON.stringify({
        systemInstruction:{parts:[{text:systemInstruction}]},
        contents:[{role:'user',parts:[{text:input}]}],
        generationConfig:{maxOutputTokens,temperature,responseMimeType:'application/json',...(responseSchema?{responseSchema}:{})}
      })
    });
    if(!response.ok){
      const detail=await response.json().catch(()=>null) as any;
      lastError=detail?.error?.message||`Falha do Gemini (${response.status}).`;
      if(response.status===404||response.status===400)continue;
      throw new Error(lastError);
    }
    const data=await response.json() as any;
    const text=data.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||'').join('').trim();
    if(!text)throw new Error('O Gemini devolveu uma resposta vazia.');
    try{return JSON.parse(text.replace(/^```json\s*|\s*```$/g,''))}
    catch{throw new Error('O Gemini não terminou de montar o caso.')}
  }
  throw new Error(lastError);
}

const caseSchema={type:'OBJECT',required:['title','summary','incident','objective','difficulty','characters','clues','solution'],properties:{title:{type:'STRING'},summary:{type:'STRING'},incident:{type:'STRING'},objective:{type:'STRING'},difficulty:{type:'STRING',enum:['dificil','especialista']},characters:{type:'ARRAY',items:{type:'OBJECT',required:['id','name','role','initials','kind','publicDescription','secret','personality'],properties:{id:{type:'STRING'},name:{type:'STRING'},role:{type:'STRING'},initials:{type:'STRING'},kind:{type:'STRING',enum:['official','suspect','witness','expert']},publicDescription:{type:'STRING'},secret:{type:'STRING'},personality:{type:'STRING'}}}},clues:{type:'ARRAY',items:{type:'OBJECT',required:['key','title','description','hiddenTruth'],properties:{key:{type:'STRING'},title:{type:'STRING'},description:{type:'STRING'},hiddenTruth:{type:'STRING'}}}},solution:{type:'OBJECT',required:['culpritId','motive','method','fullExplanation'],properties:{culpritId:{type:'STRING'},motive:{type:'STRING'},method:{type:'STRING'},fullExplanation:{type:'STRING'}}}}};
const answerSchema={type:'OBJECT',required:['reply'],properties:{reply:{type:'STRING'},revealClueKey:{type:'STRING',nullable:true}}};

export async function generateMystery(apiKey:string,difficulty:Difficulty='dificil'):Promise<MysteryCase>{
  const seed=crypto.randomUUID(),specialist=difficulty==='especialista',suspectCount=specialist?6:5,supportCount=specialist?4:3,clueCount=specialist?12:9;
  const mystery=await generate(
    apiKey,
    'Você é o diretor de um jogo policial cooperativo adulto e exigente. Crie somente ficção, sem pessoas reais. A verdade do caso é definida AGORA e nunca poderá mudar durante os interrogatórios. O mistério precisa ser justo, internamente consistente e solucionável apenas pela combinação das pistas. Cada personagem deve ter voz, temperamento, valores, medos e forma de falar claramente diferentes. O segredo e a personalidade de cada personagem devem conter fatos concretos suficientes para sustentar suas futuras respostas sem improvisar fatos novos. Nunca escreva mensagens de espera, avisos ou texto fora do JSON.',
    `Crie um caso inédito em português brasileiro usando a semente ${seed}. Dificuldade: ${difficulty}. Alterne radicalmente entre homicídio, desaparecimento, sequestro, roubo impossível, sabotagem, fraude, incêndio criminoso e espionagem industrial; varie época, cidade, ambiente, vítima, método e motivo. Crie exatamente ${suspectCount} suspeitos e ${supportCount} personagens de apoio. Todo suspeito deve ter motivo plausível, oportunidade aparente, mentira verificável e segredo. Para cada personagem, a personalidade deve descrever: jeito de falar, estado emocional inicial, gatilhos emocionais, relação com a vítima, o que sabe de verdade, o que acredita mas não sabe, o que esconderá, como reage sob pressão e o que jamais admitirá sem prova concreta. O culpado deve possuir álibi forte mas desmontável. Crie exatamente ${clueCount} pistas; nenhuma isolada resolve o caso, pelo menos três precisam ser cruzadas, duas parecem incriminar inocentes, uma revela inconsistência de horário e uma depende de perícia. IDs e keys minúsculos sem espaço. culpritId deve ser suspeito.`,
    specialist?5200:4200,
    caseSchema,
    .88
  ) as MysteryCase;
  const suspects=mystery.characters?.filter(x=>x.kind==='suspect')||[],support=mystery.characters?.filter(x=>x.kind!=='suspect')||[];
  if(!mystery.title||mystery.characters?.length!==suspectCount+supportCount||suspects.length!==suspectCount||support.length!==supportCount||mystery.clues?.length!==clueCount||!suspects.some(x=>x.id===mystery.solution?.culpritId))throw new Error('O Gemini montou um caso incompleto. Tente novamente.');
  mystery.difficulty=difficulty;
  return mystery;
}

export async function answerMystery(apiKey:string,mystery:MysteryCase,target:string,history:string,discovered:string[],question:string){
  const character=mystery.characters.find(x=>x.id===target);
  const isCentral=target==='narrador';
  const discoveredClues=mystery.clues.filter(c=>discovered.includes(c.key));
  const roleRules=isCentral
    ? `Você é SOMENTE a Central de investigação/polícia. Nunca fale como suspeito, testemunha, vítima ou perito específico. Nunca expresse sentimentos pessoais de suspeitos. Você pode ordenar buscas, perícias, cruzamentos de registros, câmeras, celulares, documentos e diligências. Só revele um fato novo se ele estiver logicamente sustentado pelo caso secreto ou por uma pista ainda não descoberta. Se a ação pedida não puder produzir informação nova consistente, diga claramente que nada conclusivo foi encontrado. Nunca invente transferências, digitais, câmeras, compras, encontros, confissões ou documentos que contradigam o caso. Não declare culpado por conta própria.`
    : `Você é exclusivamente ${character?.name}, função ${character?.role}, categoria ${character?.kind}. Sua personalidade fixa é: ${character?.personality}. Seu segredo fixo é: ${character?.secret}. Nunca fale como Central, policial ou outro personagem. Você é uma pessoa real dentro desta ficção: tenha emoções, hesitações, irritação, medo, sarcasmo, culpa, orgulho ou alívio de acordo com sua personalidade e com o histórico. Sua emoção pode evoluir, mas seus fatos NÃO mudam. Diferencie claramente: (1) o que você sabe, (2) o que você apenas suspeita e (3) o que você não sabe. Nunca invente fatos só para responder. Se não souber, admita ou especule como opinião. Se o detetive afirmar algo falso, não aceite automaticamente: corrija, negue ou fique confuso conforme o que você realmente sabe. Se for inocente, nunca confesse o crime. Se for culpado, resista e minta de forma compatível com seu segredo; só admita fatos comprometedores quando confrontado com evidências fortes e coerentes. Não repita bordões; responda especificamente à pergunta feita.`;

  const system=`Você conduz um interrogatório difícil em um jogo policial. A verdade canônica e IMUTÁVEL do caso é: ${JSON.stringify(mystery)}\n\nREGRAS DO PAPEL ATUAL:\n${roleRules}\n\nREGRAS GERAIS:\n- Preserve continuidade total com o histórico da conversa.\n- Não altere cronologia, culpado, método, motivo ou relações já estabelecidas.\n- Não use conhecimento de outras conversas que este personagem não poderia ter.\n- Pistas ainda não descobertas são informação secreta: só revele uma delas quando a pergunta/ação realmente justificar sua descoberta.\n- Nunca transforme uma hipótese do jogador em fato sem base.\n- Nunca entregue a solução inteira de uma vez.\n- Responda naturalmente em português brasileiro, com voz própria e até 120 palavras.\n- Retorne somente JSON.`;

  const input=`Pistas oficialmente descobertas: ${JSON.stringify(discoveredClues)}\nHistórico desta conversa: ${history||'sem histórico'}\nPergunta/ação atual do detetive: ${question}\n\nRetorne {"reply":string,"revealClueKey":string|null}. revealClueKey só pode ser uma key real de pista ainda não descoberta e apenas se esta conversa/ação tiver produzido evidência suficiente para revelá-la; caso contrário use null.`;
  const result=await generate(apiKey,system,input,520,answerSchema,.48) as any;
  if(!result.reply)throw new Error('Resposta incompleta do Gemini.');
  if(result.revealClueKey && (discovered.includes(result.revealClueKey) || !mystery.clues.some(c=>c.key===result.revealClueKey))) result.revealClueKey=null;
  return result;
}
