import crypto from 'node:crypto';
import { supabase } from './supabase';

export type LearningExample={
  roomCode?:string|null; sourceMessageId?:number|null; characterId?:string|null; taskType:string;
  inputText:string; teacherOutput?:string|null; correctedOutput?:string|null; teacherModel?:string|null;
  importance?:number; quality?:number; novelty?:number; metadata?:Record<string,unknown>;
};

const clamp=(n:number)=>Math.max(0,Math.min(100,Math.round(n)));
const hash=(s:string)=>crypto.createHash('sha256').update(s).digest('hex');

export function heuristicLearningScores(input:string,output=''){
  const text=(input+' '+output).toLowerCase();
  let importance=35,quality=60,novelty=55;
  const important=['evidência','evidencia','contradi','álibi','alibi','confess','perícia','pericia','timeline','cronologia','blefe','mentira','motivo','método','metodo','culpado'];
  importance+=important.filter(k=>text.includes(k)).length*7;
  if(text.length>350)importance+=8;
  if(output.length<8)quality-=30;
  if(output.length>40&&output.length<900)quality+=10;
  if(/como ia|sou uma ia|não posso ajudar/i.test(output))quality-=45;
  if(/^(sim|não|nao|ok|certo)[.!]?$/i.test(output.trim()))novelty-=35;
  return {importance:clamp(importance),quality:clamp(quality),novelty:clamp(novelty)};
}

export async function recordTrainingExample(e:LearningExample){
  const auto=heuristicLearningScores(e.inputText,e.correctedOutput||e.teacherOutput||'');
  const importance=clamp(e.importance??auto.importance),quality=clamp(e.quality??auto.quality),novelty=clamp(e.novelty??auto.novelty);
  const keep=importance>=55&&quality>=70&&novelty>=45;
  const contentHash=hash([e.taskType,e.inputText,e.teacherOutput||'',e.correctedOutput||''].join('|'));
  const {data:existing}=await supabase.from('ai_training_examples').select('id').eq('content_hash',contentHash).limit(1).maybeSingle();
  if(existing)return {id:existing.id,duplicate:true,keep};
  const {data,error}=await supabase.from('ai_training_examples').insert({
    room_code:e.roomCode||null,source_message_id:e.sourceMessageId||null,character_id:e.characterId||null,
    task_type:e.taskType,input_text:e.inputText,teacher_output:e.teacherOutput||null,corrected_output:e.correctedOutput||null,
    importance_score:importance,quality_score:quality,novelty_score:novelty,keep_for_training:keep,
    rejection_reason:keep?null:'abaixo do limiar de qualidade/importância/novidade',metadata:e.metadata||{},
    content_hash:contentHash,teacher_model:e.teacherModel||'gemini',dataset_split:'unassigned',reviewed:false
  }).select('id,keep_for_training,importance_score,quality_score,novelty_score').single();
  if(error)throw error; return {...data,duplicate:false};
}

export async function rememberImportant(input:{scope:string;roomCode?:string|null;characterId?:string|null;memoryType:string;content:string;summary?:string|null;importance?:number;confidence?:number;metadata?:Record<string,unknown>;expiresAt?:string|null}){
  const importance=clamp(input.importance??60),confidence=clamp(input.confidence??75);
  if(importance<35)return {stored:false,reason:'low_importance'};
  const contentHash=hash([input.scope,input.roomCode||'',input.characterId||'',input.memoryType,input.content].join('|'));
  const {data:existing}=await supabase.from('ai_memory_items').select('id,use_count').eq('content_hash',contentHash).eq('active',true).limit(1).maybeSingle();
  if(existing){
    await supabase.from('ai_memory_items').update({last_used_at:new Date().toISOString(),use_count:(existing.use_count||0)+1,importance_score:importance,confidence_score:confidence}).eq('id',existing.id);
    return {stored:true,id:existing.id,duplicate:true};
  }
  const {data,error}=await supabase.from('ai_memory_items').insert({scope:input.scope,room_code:input.roomCode||null,character_id:input.characterId||null,memory_type:input.memoryType,content:input.content,summary:input.summary||null,importance_score:importance,confidence_score:confidence,expires_at:input.expiresAt||null,last_used_at:null,use_count:0,metadata:input.metadata||{},content_hash:contentHash,active:true}).select('id').single();
  if(error)throw error; return {stored:true,id:data.id,duplicate:false};
}

export async function learningMetrics(){
  const {data,error}=await supabase.from('ai_learning_metrics').select('*').single();
  if(error)throw error; return data;
}

export async function pruneLearningData(days=30){
  const {data,error}=await supabase.rpc('prune_ai_learning_data',{max_low_value_age_days:days});
  if(error)throw error; return data;
}
