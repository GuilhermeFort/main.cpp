export type CharacterState={
  room_code:string; character_id:string; trust:number; fear:number; anger:number; anxiety:number; shame:number; guilt:number;
  hostility:number; cooperation:number; fatigue:number; perceived_risk:number; caught_lies:number;
  admitted_facts:any[]; stated_version:any[]; private_memory:any[]; updated_at?:string;
};

const clamp=(n:number)=>Math.max(0,Math.min(100,Math.round(n)));
const base=(roomCode:string,characterId:string):CharacterState=>({
  room_code:roomCode,character_id:characterId,trust:35,fear:15,anger:10,anxiety:25,shame:10,guilt:10,
  hostility:15,cooperation:45,fatigue:0,perceived_risk:15,caught_lies:0,admitted_facts:[],stated_version:[],private_memory:[]
});

export async function loadCharacterState(db:any,roomCode:string,characterId:string){
  const {data,error}=await db.from('character_states').select('*').eq('room_code',roomCode).eq('character_id',characterId).maybeSingle();
  if(error) throw error;
  if(data) return data as CharacterState;
  const initial=base(roomCode,characterId);
  const {data:created,error:createError}=await db.from('character_states').upsert(initial,{onConflict:'room_code,character_id'}).select('*').single();
  if(createError) throw createError;
  return created as CharacterState;
}

function has(text:string,parts:string[]){const t=text.toLowerCase();return parts.some(x=>t.includes(x));}
function addMem(list:any[],item:any,max=18){return [...(Array.isArray(list)?list:[]),item].slice(-max);}

export function stateForPrompt(state:CharacterState){
  return {
    trust:state.trust,fear:state.fear,anger:state.anger,anxiety:state.anxiety,shame:state.shame,guilt:state.guilt,
    hostility:state.hostility,cooperation:state.cooperation,fatigue:state.fatigue,perceivedRisk:state.perceived_risk,
    caughtLies:state.caught_lies,recentMemories:(state.private_memory||[]).slice(-8),recentStatements:(state.stated_version||[]).slice(-8),
    instruction:'Estes valores são estado persistente. Não os cite numericamente. Transforme-os apenas em comportamento, tom, resistência, memória e disposição para cooperar.'
  };
}

export async function evolveCharacterState(db:any,state:CharacterState,input:{question:string;reply:string;culprit:boolean;validEvidence:boolean;revealedClue?:string|null}){
  const q=input.question.toLowerCase(), r=input.reply.toLowerCase();
  let trust=state.trust, fear=state.fear, anger=state.anger, anxiety=state.anxiety, shame=state.shame, guilt=state.guilt,
      hostility=state.hostility, cooperation=state.cooperation, fatigue=state.fatigue+1, perceived=state.perceived_risk, caught=state.caught_lies;

  if(has(q,['por favor','quero entender','quero ouvir','pode me explicar','sem te acusar','vamos entender'])){trust+=4;cooperation+=3;hostility-=2;}
  if(has(q,['você matou','voce matou','assassino','culpado','confessa','confesse'])){anger+=6;hostility+=5;trust-=4;anxiety+=input.culprit?7:3;if(input.culprit)fear+=4;}
  if(has(q,['preso','prisão','prisao','cadeia','mandado','advogado'])){fear+=input.culprit?7:3;hostility+=2;perceived+=5;}
  if(has(q,['mentiu','mentira','contradição','contradicao','sua versão mudou','sua versao mudou'])){anxiety+=6;shame+=3;perceived+=6;}
  if(input.validEvidence){fear+=input.culprit?10:4;anxiety+=9;perceived+=12;cooperation+=2;}
  if(input.revealedClue){perceived+=5;anxiety+=4;}
  if(has(r,['eu menti','menti sobre','não contei','nao contei','omiti','a verdade é','a verdade e'])){shame+=5;cooperation+=5;caught+=1;}
  if(input.culprit && has(r,['eu fiz','fui eu','eu matei','eu causei','eu coloquei','eu planejei'])){guilt+=12;fear+=10;perceived+=15;}
  if(!input.culprit && has(r,['não fui eu','nao fui eu','isso é mentira','isso e mentira','impossível','impossivel'])){anger+=2;}

  const now=new Date().toISOString();
  const statement={at:now,question:input.question.slice(0,220),reply:input.reply.slice(0,360),validEvidence:input.validEvidence};
  const memory={at:now,type:input.validEvidence?'evidence_confrontation':'interaction',summary:`Pergunta: ${input.question.slice(0,150)} | Resposta: ${input.reply.slice(0,220)}`};
  const next={
    trust:clamp(trust),fear:clamp(fear),anger:clamp(anger),anxiety:clamp(anxiety),shame:clamp(shame),guilt:clamp(guilt),
    hostility:clamp(hostility),cooperation:clamp(cooperation),fatigue:clamp(fatigue),perceived_risk:clamp(perceived),caught_lies:Math.max(0,caught),
    stated_version:addMem(state.stated_version,statement,20),private_memory:addMem(state.private_memory,memory,20),updated_at:now
  };
  const {error}=await db.from('character_states').update(next).eq('room_code',state.room_code).eq('character_id',state.character_id);
  if(error) throw error;
  return {...state,...next} as CharacterState;
}
