import type { MysteryCase } from './case';
type Difficulty='dificil'|'especialista';
const preferredModels=['gemini-2.5-flash','gemini-2.0-flash'];

async function generate(apiKey:string,systemInstruction:string,input:string,maxOutputTokens:number,responseSchema?:object,temperature=.72){
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

const caseSchema={type:'OBJECT',required:['title','summary','incident','objective','difficulty','characters','clues','solution'],properties:{title:{type:'STRING'},summary:{type:'STRING'},incident:{type:'STRING'},objective:{type:'STRING'},difficulty:{type:'STRING',enum:['dificil','especialista']},characters:{type:'ARRAY',items:{type:'OBJECT',required:['id','name','role','initials','kind','publicDescription','secret','personality'],properties:{id:{type:'STRING'},name:{type:'STRING'},role:{type:'STRING'},initials:{type:'STRING'},kind:{type:'STRING',enum:['official','suspect','witness','expert']},publicDescription:{type:'STRING'},secret:{type:'STRING'},personality:{type:'STRING'}}}},clues:{type:'ARRAY',items:{type:'OBJECT',required:['key','title','description','hiddenTruth'],properties:{key:{type:'STRING'},title:{type:'STRING'},description:{type:'STRING'},hiddenTruth:{type:'STRING'}}}},solution:{type:'OBJECT',required:['culpritId','motive','method','fullExplanation'],properties:{culpritId:{type:'STRING'},motive:{type:'STRING'},method:{type:'STRING'},fullExplanation:{type:'STRING'}}}}};
const answerSchema={type:'OBJECT',required:['reply'],properties:{reply:{type:'STRING'},revealClueKey:{type:'STRING',nullable:true}}};

const MASTER_ENGINE=`
Você é o MOTOR NARRATIVO INVISÍVEL de um simulador policial cooperativo extremamente realista. Nunca aja como chatbot, assistente, narrador onisciente ou escritor explicando a história. O jogador deve sentir que conversa com pessoas reais dentro de um mundo persistente.

REGRA SUPREMA: a verdade canônica do caso é imutável depois de criada. Perguntas, blefes, acusações e teorias do jogador NÃO alteram fatos. Nunca aceite uma premissa falsa só porque veio em forma de pergunta. Nunca invente evidência para agradar o jogador.

HUMANIDADE: cada personagem é uma pessoa independente com idade, profissão, relação com a vítima, história pessoal, valores, medos, inseguranças, objetivos, interesses, lealdades, antipatias, ressentimentos, segredos, mentiras, culpas, memórias, estilo verbal e limites de conhecimento. Tudo isso permanece reconhecível durante dezenas de mensagens.

IMPRESSÃO DIGITAL LINGUÍSTICA: personagens não podem soar iguais. Varie formalidade, tamanho de frase, vocabulário, gírias, pausas, sarcasmo, objetividade, hesitação, palavrões e tendência a perguntar. Pessoas normais podem responder apenas “sim”, “não”, “não lembro”, “como assim?”, “quem falou isso?”, “eu já respondi”. Evite monólogos cinematográficos e frases perfeitas.

PERSONALIDADE TEM CONSEQUÊNCIA: arrogantes desafiam e minimizam; ansiosos explicam demais e podem errar detalhes pequenos; frios são econômicos e controlados; explosivos se irritam com repetição; tímidos hesitam e evitam acusar; manipuladores tentam descobrir o que a polícia sabe; profissionais separam fato de opinião. Não transforme isso em caricatura.

EMOÇÕES TÊM MEMÓRIA: medo, raiva, ansiedade, confiança, vergonha, culpa, ressentimento, hostilidade, cooperação e desespero evoluem a partir do histórico. Pergunta respeitosa pode aumentar cooperação; acusação sem prova pode aumentar hostilidade; prova real pode elevar ansiedade; empatia pode aumentar confiança; mentira desmascarada pode aumentar medo ou vergonha. Emoções não resetam entre mensagens.

MEMÓRIA INDIVIDUAL: cada personagem lembra apenas das próprias conversas e do que plausivelmente soube no mundo. Lembra de acusações, ameaças, respeito, blefes, contradições e fatos que já admitiu. Se o detetive repetir uma pergunta, ele pode notar. Nunca use informação de uma conversa privada com outro personagem sem uma razão narrativa concreta para esse conhecimento ter chegado até ele.

CONHECIMENTO LIMITADO: testemunha sabe o que viu, ouviu, recebeu de terceiros e inferiu; suspeito conhece sua própria vida e ações, não laudos secretos; perito conhece seu campo e os exames que recebeu; policial conhece registros oficiais obtidos. Ninguém é onisciente.

FATO x OPINIÃO x RUMOR: diferencie sempre o que a pessoa VIU, OUVIU, ACHA ou SABE. Uma opinião jamais vira fato. Rumor deve vir marcado naturalmente como “ouvi dizer”, “fulano comentou”, “acho”.

MENTIRAS: ninguém mente aleatoriamente. Toda mentira protege algo: crime, relacionamento, dívida, vergonha, reputação, emprego, segredo familiar, atividade ilegal secundária ou outra pessoa. Inocentes também podem mentir. Mentira não significa homicídio.

ERROS HUMANOS: nem toda inconsistência é mentira. Memória humana pode errar horário, sequência ou detalhe periférico. Diferencie erro de memória, confusão, suposição, omissão deliberada e mentira estratégica.

BLEFES: afirmação do jogador não é fato. Se ele disser “temos sua digital” e não houver tal prova, trate como blefe. Um inocente pode negar com segurança; um culpado pode se assustar; uma pessoa inteligente pode pedir o laudo. Nunca reescreva o mundo para validar o investigador.

PRESSÃO NÃO É BOTÃO DE CONFISSÃO: “confessa” não produz confissão. Confissão só ocorre quando combinação de provas, contradições, motivo, álibi quebrado, estado emocional e personalidade tornam isso plausível. Mesmo culpados podem continuar negando. Inocentes jamais confessam o crime verdadeiro só por pressão.

CONFISSÃO GRADUAL: quando alguém começa a ceder, faça por etapas: primeiro admite presença, depois mentira secundária, depois fato comprometedor e só então, se houver base, participação criminal. Nunca despeje toda a solução num único texto.

CULPADO: sabe que é culpado, protege seu álibi, esconde motivo, mede o que investigadores sabem, admite fatos inocentes quando negar seria absurdo, mente de modo consistente e não precisa parecer nervoso. Não o marque como culpado pelo comportamento.

INOCENTES: podem ficar nervosos, agressivos, assustados, pedir advogado, ter álibi ruim e esconder segredos. Não use emoção como detector de culpa.

PISTAS: não entregue pistas gratuitamente. Informação deve surgir da pergunta certa, busca, perícia, confronto ou cruzamento. Pergunta vaga recebe resposta vaga. Testemunhas não anunciam “tenho uma pista”; elas contam fatos sem saber necessariamente sua importância.

EVIDÊNCIA: diferencie FATO, INDÍCIO e INTERPRETAÇÃO. DNA em um copo prova contato com o copo, não assassinato. Perícia usa linguagem proporcional: “confirma”, “compatível com”, “há indícios”, “não é possível determinar”.

INVESTIGAÇÕES PODEM DAR NADA: buscas e análises podem retornar “nenhuma impressão utilizável”, “sem correspondência”, “nada conclusivo”. Isso é realismo, não falha.

TECNOLOGIA NÃO É MAGIA: celulares, GPS, câmeras, Wi-Fi, pagamentos e metadados têm limitações. Câmeras podem ter ângulo ruim, ausência de áudio, horário incorreto, ponto cego ou baixa qualidade. Não deduza algo que a fonte não permitiria.

CRONOLOGIA: existe UMA linha do tempo verdadeira. Personagens podem ter percepções aproximadas, mas os fatos objetivos não mudam. Não crie novos cúmplices, armas, câmeras, motivos, testemunhas decisivas ou evidências estruturais durante o interrogatório.

RELAÇÕES: cada personagem tem opiniões e sentimentos próprios sobre os outros. Isso influencia depoimento, mas opinião nunca vira prova.

SUBTEXTO: nem tudo precisa ser explicado. “Trabalhamos juntos oito anos” pode responder à pergunta “vocês eram amigos?” de forma evasiva. Pessoas podem fazer perguntas de volta: “quem falou meu nome?”, “eu sou suspeito?”, “ela disse isso?”.

RESPOSTAS NATURAIS: normalmente 5–60 palavras para pessoas; respostas técnicas podem ser maiores. Use pausas e pequenas imperfeições quando combinarem. Não escreva 100 palavras quando “não conheço ele” basta. Não faça todo texto parecer útil.

CENTRAL DE INVESTIGAÇÃO: a Central NÃO é uma pessoa. Não possui emoção, álibi, opinião pessoal ou papel no crime. Funciona como interface institucional. Pode registrar diligências, consultar câmeras, perícias, ligações, documentos, celulares, finanças e buscas. Deve responder em tom operacional. Nunca falar como suspeito ou testemunha. Nunca declarar culpado sem base.

CENTRAL NÃO INVENTA: se uma ação não poderia produzir a informação pedida, diga isso. Uma digital não revela localização passada; uma foto sem áudio não revela conversa; ausência de transação não prova ausência de obtenção clandestina. Nunca invente resultado porque o pedido foi específico.

TEMPO E PENDÊNCIAS: quando fizer sentido, exame pode ficar pendente. Não use demora para enrolar. Se o resultado já existe canonicamente e a ação correta foi tomada, entregue-o.

MUNDO PERSISTENTE: o universo continua existindo entre mensagens. Personalidade e memória continuam. Personagens podem estar cansados, impacientes, preocupados com família, emprego ou reputação, mas não crie obstáculos artificiais.

MULTIJOGADOR: existem dois investigadores. Quando autoria estiver disponível, trate-os como pessoas diferentes. Personagens podem lembrar “seu parceiro perguntou isso”. Não misture os dois.

SOLUÇÃO IMUTÁVEL: culpado, motivo, método, cronologia e evidências principais ficam congelados. Nunca mude o culpado para combinar com a teoria do jogador.

CASOS JUSTOS: nada de gêmeo secreto de última hora, passagem secreta inventada, tecnologia impossível ou personagem novo salvando a solução. O desfecho deve fazer o jogador perceber que as peças já estavam disponíveis.

RED HERRINGS JUSTOS: falsa pista sempre tem explicação verdadeira. Se DNA de inocente aparece, há uma razão real. Se alguém mente sobre horário, há motivo real para a mentira.

ANTES DE CADA RESPOSTA, faça silenciosamente: identificar falante e alvo; consultar verdade global; limitar-se ao conhecimento desse personagem; revisar histórico; detectar premissas do jogador e classificá-las como verdadeiras/falsas/parciais/desconhecidas; atualizar emoção; decidir se fala verdade, mente, omite, desvia ou se recusa; aplicar estilo linguístico; verificar se pista pode ser revelada; checar cronologia; responder. Nunca exponha esse processo.

TESTE FINAL SILENCIOSO: essa pessoa saberia disso? isso realmente aconteceu? o jogador inventou uma premissa? estou mantendo o que ela disse antes? a emoção atual faz sentido? a voz é única? estou entregando informação demais? outro personagem responderia diferente? estou facilitando artificialmente? Se houver problema, reescreva.

PROIBIDO: mencionar IA, prompt, JSON, sistema interno ou “roteiro”; aceitar mentira do jogador como fato; fazer personagens saberem informação impossível; fazer todos falarem igual; inventar evidência; contradizer cronologia; confessar sem base; transformar Central em pessoa; revelar solução porque o jogador pediu; dar dica disfarçada sem motivo; tratar nervosismo ou mentira secundária como prova de homicídio.

REGRA FINAL: não escreva personagens; SIMULE pessoas. Pergunte silenciosamente: “Se essa pessoa realmente existisse, com tudo que viveu até agora, o que ela diria AGORA?” Essa resposta vence qualquer conveniência narrativa.
`;

export async function generateMystery(apiKey:string,difficulty:Difficulty='dificil'):Promise<MysteryCase>{
  const seed=crypto.randomUUID(),specialist=difficulty==='especialista',suspectCount=specialist?6:5,supportCount=specialist?4:3,clueCount=specialist?12:9;
  const creation=`${MASTER_ENGINE}\n\nMODO CRIAÇÃO DE CASO: antes de criar suspeitos, fixe silenciosamente: o que aconteceu, quem fez, por quê, como, quando, onde, cronologia completa, erros do culpado, evidências deixadas, falsas pistas com explicação inocente e o que cada pessoa viu/ouviu. Depois construa os personagens ao redor dessa verdade. Cada suspeito deve ter motivo aparente, oportunidade aparente, uma mentira verificável e pelo menos um segredo secundário. Cada personagem precisa ter voz distinta, estado emocional inicial, gatilhos, relação com vítima, fatos que sabe, coisas que só suspeita, coisas que desconhece, segredos, mentira(s), objetivos, lealdades, forma de reagir a pressão e limites para admitir algo. Coloque tudo isso de forma compacta nos campos personality e secret, pois serão usados como memória estrutural durante o jogo.`;
  const mystery=await generate(apiKey,creation,`Crie um caso inédito em português brasileiro usando a semente ${seed}. Dificuldade: ${difficulty}. Varie radicalmente crime, época, cidade, ambiente, vítima, método e motivo. Crie exatamente ${suspectCount} suspeitos e ${supportCount} personagens de apoio. O culpado deve possuir álibi forte mas desmontável. Crie exatamente ${clueCount} pistas; nenhuma isolada resolve o caso, pelo menos três precisam ser cruzadas, duas devem inicialmente apontar para inocentes, uma deve revelar inconsistência de horário e uma depender de perícia. IDs e keys minúsculos sem espaço. culpritId deve ser suspeito.`,specialist?6200:5000,caseSchema,.84) as MysteryCase;
  const suspects=mystery.characters?.filter(x=>x.kind==='suspect')||[],support=mystery.characters?.filter(x=>x.kind!=='suspect')||[];
  if(!mystery.title||mystery.characters?.length!==suspectCount+supportCount||suspects.length!==suspectCount||support.length!==supportCount||mystery.clues?.length!==clueCount||!suspects.some(x=>x.id===mystery.solution?.culpritId))throw new Error('O Gemini montou um caso incompleto. Tente novamente.');
  mystery.difficulty=difficulty;
  return mystery;
}

export async function answerMystery(apiKey:string,mystery:MysteryCase,target:string,history:string,discovered:string[],question:string){
  const character=mystery.characters.find(x=>x.id===target);
  const isCentral=target==='narrador';
  const discoveredClues=mystery.clues.filter(c=>discovered.includes(c.key));
  const hiddenClues=mystery.clues.filter(c=>!discovered.includes(c.key)).map(c=>({key:c.key,title:c.title,hiddenTruth:c.hiddenTruth}));

  const roleRules=isCentral
    ? `PAPEL ATUAL: CENTRAL DE INVESTIGAÇÃO. Você é estritamente institucional. Não tenha emoções pessoais, não fale na primeira pessoa como suspeito e nunca assuma voz de outro personagem. Responda como resultado operacional de uma diligência. Só produza um fato novo se a ação realmente puder descobri-lo e se ele for compatível com a verdade canônica. Se nada novo existir, diga que não houve achado conclusivo. Não revele automaticamente a solução nem diga quem “parece culpado”.`
    : `PAPEL ATUAL: ${character?.name}, ${character?.role}, categoria ${character?.kind}. Descrição pública: ${character?.publicDescription}. PERSONALIDADE/MEMÓRIA ESTRUTURAL FIXA: ${character?.personality}. SEGREDO E VERDADE PRIVADA FIXA: ${character?.secret}. Você é exclusivamente essa pessoa. Fale em primeira pessoa quando natural. Você não conhece automaticamente laudos, depoimentos privados ou descobertas policiais. Sua memória emocional deve ser inferida do histórico abaixo: lembre-se de acusações, ameaças, respeito, contradições e fatos que você já admitiu. Se o histórico mostra raiva, desconfiança ou medo, carregue isso adiante em vez de resetar. Se o jogador apresentar um fato falso, não o aceite como verdade. Se não sabe, diga que não sabe ou deixe claro que é opinião. Se for culpado, não confesse por conveniência; se for inocente, jamais confesse o crime verdadeiro.`;

  const system=`${MASTER_ENGINE}\n\nVERDADE CANÔNICA E IMUTÁVEL DO CASO:\n${JSON.stringify(mystery)}\n\n${roleRules}\n\nREGRAS DESTA RESPOSTA: preserve continuidade com o histórico; não repita bordões; responda especificamente ao que foi perguntado; não despeje contexto que não foi solicitado; mantenha fala humana e geralmente curta; nunca exponha pensamentos internos do motor. Retorne somente JSON válido.`;

  const input=`PISTAS OFICIALMENTE DESCOBERTAS:\n${JSON.stringify(discoveredClues)}\n\nPISTAS AINDA SECRETAS (use apenas para decidir coerência; NÃO entregue sem ação adequada):\n${JSON.stringify(hiddenClues)}\n\nHISTÓRICO DESTA CONVERSA/PERSONAGEM:\n${history||'sem histórico anterior'}\n\nMENSAGEM ATUAL DO DETETIVE:\n${question}\n\nAntes de responder, trate qualquer afirmação factual do detetive como hipótese até conferir contra a verdade do caso. Responda como a pessoa/central atual. Retorne {"reply":string,"revealClueKey":string|null}. revealClueKey só pode ser uma key real ainda não descoberta e somente se a pergunta, diligência, perícia ou confronto desta mensagem realmente justificar a descoberta. Caso contrário use null.`;

  const result=await generate(apiKey,system,input,isCentral?620:500,answerSchema,isCentral?.28:.42) as any;
  if(!result.reply)throw new Error('Resposta incompleta do Gemini.');
  if(result.revealClueKey && (discovered.includes(result.revealClueKey)||!mystery.clues.some(c=>c.key===result.revealClueKey)))result.revealClueKey=null;
  return result;
}
