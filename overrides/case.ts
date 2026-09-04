export type CaseCharacter={id:string;name:string;role:string;initials:string;publicDescription:string;secret:string;personality:string;kind:'official'|'suspect'|'witness'|'expert'};
export type CaseClue={key:string;title:string;description:string;hiddenTruth:string};
export type WorldArtifact={key:string;type:string;title:string;content:string;minuteLabel:string;source:string;reliability:number};
export type WorldLocation={key:string;name:string;kind:string;description:string;x:number;y:number;knownInitially:boolean};
export type WorldDevice={key:string;ownerCharacterId:string;type:string;label:string;description:string;knownInitially:boolean;requiresWarrant:boolean;artifacts:WorldArtifact[]};
export type WorldCameraEvent={key:string;minuteLabel:string;description:string;visibleDetails:string;confidence:number};
export type WorldCamera={key:string;name:string;locationKey:string;angleDescription:string;hasAudio:boolean;clockOffsetSeconds:number;quality:string;status:string;knownInitially:boolean;events:WorldCameraEvent[]};
export type CaseWorld={locations:WorldLocation[];devices:WorldDevice[];cameras:WorldCamera[]};
export type MysteryCase={title:string;summary:string;incident:string;objective:string;difficulty:'dificil'|'especialista';characters:CaseCharacter[];clues:CaseClue[];solution:{culpritId:string;motive:string;method:string;fullExplanation:string};world?:CaseWorld};

const defaultWorld:CaseWorld={
  locations:[
    {key:'hotel-bellmont',name:'Hotel Bellmont',kind:'hotel',description:'Edifício onde ocorreu o crime.',x:48,y:50,knownInitially:true},
    {key:'quarto-1209',name:'Suíte 1209',kind:'crime_scene',description:'Quarto onde Eduardo Duarte foi encontrado morto.',x:68,y:34,knownInitially:true},
    {key:'quarto-1207',name:'Quarto 1207',kind:'hotel_room',description:'Quarto ocupado por Rafael, conectado internamente ao 1209.',x:32,y:34,knownInitially:true},
    {key:'recepcao',name:'Recepção e sala de segurança',kind:'hotel_security',description:'Área de controle de acessos e gravações.',x:50,y:76,knownInitially:true},
    {key:'estacionamento',name:'Estacionamento do hotel',kind:'parking',description:'Entrada e saída de hóspedes e visitantes.',x:18,y:78,knownInitially:true}
  ],
  devices:[
    {key:'celular-rafael',ownerCharacterId:'rafael',type:'phone',label:'Celular de Rafael Duarte',description:'Aparelho pessoal de Rafael.',knownInitially:true,requiresWarrant:true,artifacts:[
      {key:'rafael-call-2217',type:'call_log',title:'Ligação às 22h17',content:'Registro de chamada de Rafael para Eduardo às 22h17.',minuteLabel:'22:17',source:'Celular de Rafael',reliability:98},
      {key:'rafael-transfer',type:'bank_notification',title:'Transferência na manhã seguinte',content:'Notificação bancária registra transferência para Beatriz na manhã seguinte ao crime.',minuteLabel:'manhã seguinte',source:'Celular de Rafael',reliability:92}
    ]},
    {key:'terminal-seguranca',ownerCharacterId:'beatriz',type:'computer',label:'Terminal da segurança do Bellmont',description:'Estação usada para administrar câmeras e acessos.',knownInitially:true,requiresWarrant:false,artifacts:[
      {key:'camera-disable-log',type:'system_log',title:'Desativação manual das câmeras',content:'O sistema registra desativação manual entre 22h14 e 22h22 por uma sessão da recepção.',minuteLabel:'22:14–22:22',source:'Terminal da segurança',reliability:99},
      {key:'security-login',type:'login_log',title:'Sessão ativa da recepção',content:'A estação estava autenticada sob a sessão de trabalho de Beatriz durante o intervalo.',minuteLabel:'22:14',source:'Terminal da segurança',reliability:90}
    ]},
    {key:'pendrive-azul',ownerCharacterId:'',type:'storage',label:'Pendrive azul',description:'Dispositivo localizado na base de um abajur da suíte 1209.',knownInitially:false,requiresWarrant:false,artifacts:[
      {key:'fraude-files',type:'document',title:'Arquivos de fraude',content:'Planilhas e documentos apontam irregularidades financeiras que explicam o conflito entre Eduardo e Rafael.',minuteLabel:'sem horário',source:'Pendrive azul',reliability:95}
    ]}
  ],
  cameras:[
    {key:'camera-corredor-12',name:'Câmera do corredor do 12º andar',locationKey:'hotel-bellmont',angleDescription:'Cobre elevadores e corredor principal, mas não enxerga a passagem interna entre 1207 e 1209.',hasAudio:false,clockOffsetSeconds:0,quality:'medium',status:'online',knownInitially:true,events:[
      {key:'corridor-before-gap',minuteLabel:'22:13',description:'Corredor aparentemente vazio pouco antes da interrupção.',visibleDetails:'Nenhuma entrada pela porta externa do 1209 é visível.',confidence:88},
      {key:'corridor-gap',minuteLabel:'22:14–22:22',description:'Não há gravação disponível durante oito minutos.',visibleDetails:'A interrupção coincide com o período crítico do caso.',confidence:100},
      {key:'corridor-after-gap',minuteLabel:'22:23',description:'Gravação retorna sem registrar alguém saindo pela porta externa do 1209.',visibleDetails:'Isso não exclui uso da porta comunicante.',confidence:86}
    ]},
    {key:'camera-recepcao',name:'Câmera da recepção',locationKey:'recepcao',angleDescription:'Mostra parcialmente o balcão e a estação de segurança; a tela do computador não é legível.',hasAudio:false,clockOffsetSeconds:4,quality:'low',status:'online',knownInitially:true,events:[
      {key:'beatriz-console',minuteLabel:'22:14',description:'Uma pessoa compatível com Beatriz permanece junto ao console de segurança.',visibleDetails:'A imagem não permite ler comandos na tela.',confidence:78}
    ]},
    {key:'camera-estacionamento',name:'Câmera do estacionamento',locationKey:'estacionamento',angleDescription:'Cobre a saída de veículos, com reflexos em parte do quadro.',hasAudio:false,clockOffsetSeconds:-11,quality:'medium',status:'online',knownInitially:true,events:[
      {key:'laura-leaves',minuteLabel:'antes do horário crítico',description:'Um veículo compatível com o de Laura deixa o estacionamento antes do intervalo crítico.',visibleDetails:'A placa é parcialmente legível e compatível com o cadastro.',confidence:82}
    ]}
  ]
};

export const defaultCase:MysteryCase={title:'O silêncio do quarto 1209',summary:'Um empresário é encontrado morto em uma suíte sem sinais de invasão pelo corredor.',incident:'22h31. Hotel Bellmont. Eduardo Duarte foi encontrado morto no quarto 1209. O corredor não mostra sinais de invasão — e oito minutos das câmeras desapareceram.',objective:'Descubram quem matou Eduardo, como entrou no quarto e por quê.',difficulty:'dificil',characters:[{id:'delegada',name:'Delegada Helena',role:'Chefe da investigação',initials:'DH',kind:'official',publicDescription:'Coordena buscas, prisões e depoimentos oficiais.',secret:'Conhece o relatório preliminar, mas só libera conclusões quando os detetives pedem o exame correto.',personality:'Direta, metódica e exigente com a cadeia de provas.'},{id:'perito',name:'Perito André',role:'Perícia criminal',initials:'PA',kind:'expert',publicDescription:'Analisa impressões, câmeras, objetos e horários.',secret:'Sabe que a porta comunicante foi usada, mas espera uma solicitação específica para confirmar.',personality:'Técnico, preciso e avesso a suposições.'},{id:'rafael',name:'Rafael Duarte',role:'Irmão da vítima',initials:'RD',kind:'suspect',publicDescription:'Afirma que permaneceu no quarto 1207.',secret:'Entrou no 1209 pela porta comunicante e matou Eduardo durante uma briga pelo pendrive.',personality:'Nervoso, impulsivo e defensivo.'},{id:'beatriz',name:'Beatriz Alves',role:'Recepcionista',initials:'BA',kind:'suspect',publicDescription:'Estava responsável pelas câmeras do hotel.',secret:'Desligou as câmeras por oito minutos a pedido de Rafael em troca de dinheiro.',personality:'Controlada, mas se contradiz sobre dinheiro e registros.'},{id:'camila',name:'Camila Torres',role:'Testemunha',initials:'CT',kind:'witness',publicDescription:'Diz que deixou o hotel antes do crime.',secret:'Estava escondida no banheiro, ouviu a discussão e viu Rafael sair.',personality:'Assustada e evasiva.'},{id:'laura',name:'Laura Ferraz',role:'Esposa da vítima',initials:'LF',kind:'suspect',publicDescription:'Nega ter ido ao hotel naquela noite.',secret:'Visitou Camila, mas saiu antes da morte e é inocente.',personality:'Orgulhosa e direta.'}],clues:[{key:'camera',title:'Falha nas câmeras',description:'O sistema foi desativado manualmente entre 22h14 e 22h22.',hiddenTruth:'Beatriz realizou a desativação.'},{key:'call',title:'Ligação impossível',description:'Rafael ligou para Eduardo às 22h17, embora estivesse no quarto ao lado.',hiddenTruth:'A ligação serviu para fabricar um álibi.'},{key:'door',title:'Porta comunicante',description:'Os quartos 1207 e 1209 possuem uma porta interna usada naquela noite.',hiddenTruth:'Rafael entrou por ela.'},{key:'witness',title:'Testemunha oculta',description:'Alguém permaneceu no banheiro do 1209 durante a discussão.',hiddenTruth:'Camila presenciou parte do crime.'},{key:'payment',title:'Pagamento à recepção',description:'Uma transferência suspeita ocorreu na manhã seguinte.',hiddenTruth:'Rafael pagou Beatriz pelo corte das câmeras.'},{key:'drive',title:'O pendrive azul',description:'O dispositivo foi escondido dentro da base de um abajur.',hiddenTruth:'Contém provas de fraude que motivaram o confronto.'}],solution:{culpritId:'rafael',motive:'Recuperar provas de fraude e proteger a família.',method:'Entrou pela porta comunicante e atingiu Eduardo durante uma briga.',fullExplanation:'Rafael pagou Beatriz para desligar as câmeras, entrou no 1209 pelo quarto ao lado e tentou recuperar o pendrive. Camila viu sua saída. Laura havia deixado o hotel antes da morte.'},world:defaultWorld};

export function readCase(value:string|null|undefined):MysteryCase{
  if(!value)return defaultCase;
  try{
    const parsed=JSON.parse(value) as MysteryCase;
    if(!parsed.title||!Array.isArray(parsed.characters)||parsed.characters.length<3||!Array.isArray(parsed.clues))return defaultCase;
    parsed.difficulty||='dificil';
    if(!parsed.world&&parsed.title===defaultCase.title)parsed.world=defaultWorld;
    return parsed;
  }catch{return defaultCase}
}
export function publicCase(m:MysteryCase){return{title:m.title,summary:m.summary,incident:m.incident,objective:m.objective,difficulty:m.difficulty,characters:m.characters.map(({id,name,role,initials,publicDescription,kind})=>({id,name,role,initials,publicDescription,kind}))}}
