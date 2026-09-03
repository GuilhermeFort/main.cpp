import { getSupabase, throwIfError } from "../../../lib/supabase";
import { readCase } from "../../../lib/case";
import { answerMystery } from "../../../lib/gemini";
import { decryptSecret } from "../../../lib/secrets";
import { heuristicLearningScores, recordTrainingExample, rememberImportant } from "../../../lib/learning";
import { evolveCharacterState, loadCharacterState, stateForPrompt } from "../../../lib/psychology";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function normalize(s:string){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()}
function evidenceWasValid(question:string,mystery:any,found:string[]){
  const marker='[EVIDÊNCIA APRESENTADA AO DEPOENTE]'; if(!question.includes(marker))return false;
  const shown=question.split(marker)[1]?.split('\n\n')[0]?.trim()||'',n=normalize(shown);
  return mystery.clues.filter((c:any)=>found.includes(c.key)).some((c:any)=>{const a=normalize(c.title),b=normalize(c.description);return n.includes(a)||a.includes(n)||n.includes(b.slice(0,Math.min(70,b.length)));});
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { code?: string; playerId?: string; target?: string; content?: string };
    const roomCode = body.code?.trim().toUpperCase() || "";
    const content = body.content?.trim().slice(0, 1200) || "";
    if (!roomCode || !body.playerId || !content) return Response.json({ error: "Pergunta inválida." }, { status: 400 });
    const db = getSupabase();
    const [{ data: room, error: roomError }, { data: player, error: playerError }] = await Promise.all([
      db.from("rooms").select("*").eq("code", roomCode).maybeSingle(),
      db.from("players").select("*").eq("room_code", roomCode).eq("player_id", body.playerId).maybeSingle(),
    ]);
    throwIfError(roomError); throwIfError(playerError);
    if (!room || !player) return Response.json({ error: "Sessão inválida." }, { status: 403 });
    const mystery = readCase(room.case_data);

    const taskMatch=content.match(/^\[TAREFA DE INVESTIGAÇÃO #(\d+)\]/);
    const requestedTaskId=taskMatch?Number(taskMatch[1]):null;
    let taskRow:any=null;
    if(requestedTaskId){
      const {data,error}=await db.from('investigation_tasks').select('*').eq('id',requestedTaskId).eq('room_code',roomCode).eq('status','pending').maybeSingle();
      throwIfError(error); if(!data)return Response.json({error:'Essa tarefa não está mais pendente.'},{status:409}); taskRow=data;
    }
    const target = requestedTaskId ? "narrador" : (body.target === "narrador" || mystery.characters.some((item) => item.id === body.target) ? body.target! : "narrador");
    throwIfError((await db.from("messages").insert({ room_code: roomCode, thread_player_id: player.player_id, author: player.name, role: "detective", target, content })).error);

    const [{ data: foundRows, error: foundError }, { data: recent, error: recentError }] = await Promise.all([
      db.from("discovered_clues").select("clue_key").eq("room_code", roomCode),
      db.from("messages").select("author,content,id,role,thread_player_id").eq("room_code", roomCode).eq("target",target).order("id", { ascending: true }).limit(60),
    ]);
    throwIfError(foundError); throwIfError(recentError);
    const found = (foundRows || []).map((item) => item.clue_key);
    let psych:any=null;
    if(target!=="narrador") psych=await loadCharacterState(db,roomCode,target);
    const psychContext=psych?`\n[ESTADO PSICOLÓGICO PERSISTENTE DO DEPOENTE — NÃO MOSTRAR AO JOGADOR]\n${JSON.stringify(stateForPrompt(psych))}\n`:'';
    const history = psychContext+(recent || []).slice(-18).map((item:any) => `${item.author}: ${item.content}`).join(" | ");
    const apiKey = room.api_key_cipher ? await decryptSecret(room.api_key_cipher) : process.env.GEMINI_API_KEY;
    let reply: string; let revealClueKey: string | null | undefined;
    let usedTeacher=false;
    const effectiveContent=taskRow?`${content}\n\nDADOS DA TAREFA REGISTRADA: tipo=${taskRow.task_type}; alvo=${taskRow.target||'não informado'}; solicitação=${JSON.stringify(taskRow.request_data||{})}. Responda como resultado operacional da Central, sem inventar além do caso canônico.`:content;
    if (apiKey) {
      const result = await answerMystery(apiKey, mystery, target, history, found, effectiveContent);
      reply = result.reply!; revealClueKey = result.revealClueKey; usedTeacher=true;
    } else {
      const character = mystery.characters.find((item) => item.id === target);
      reply = target === "narrador" ? `A Central registrou sua pergunta. Configure o Gemini para investigar este caso de forma livre. Por enquanto, concentrem-se em: ${mystery.objective}` : `${character?.name || "O suspeito"} observa vocês em silêncio. Configure o Gemini para iniciar o interrogatório livre.`;
    }
    if (revealClueKey && mystery.clues.some((clue) => clue.key === revealClueKey)) {
      const clue=mystery.clues.find((c:any)=>c.key===revealClueKey)!;
      const { error } = await db.from("discovered_clues").upsert({ room_code: roomCode, clue_key: revealClueKey, discovered_by: player.player_id }, { onConflict: "room_code,clue_key", ignoreDuplicates: true });
      throwIfError(error);
      const evidenceCode=`CLUE-${revealClueKey}`;
      const {data:existing}=await db.from('evidence_items').select('id').eq('room_code',roomCode).eq('evidence_code',evidenceCode).maybeSingle();
      if(!existing){
        const {error:eErr}=await db.from('evidence_items').insert({room_code:roomCode,evidence_code:evidenceCode,title:clue.title,description:clue.description,category:'clue',source_type:target==='narrador'?'official_investigation':'interview',location_found:null,collected_by:player.name,collected_at:new Date().toISOString(),reliability:85,canonical_fact:{clueKey:clue.key},discovered:true,discovered_by:player.player_id});
        if(!eErr){
          await Promise.allSettled([
            db.from('custody_events').insert({room_code:roomCode,evidence_code:evidenceCode,actor:player.name,action:'descoberta registrada',location:null,details:`Pista obtida em ${target==='narrador'?'diligência da Central':`conversa com ${target}`}.`}),
            db.from('timeline_events').insert({room_code:roomCode,event_time:null,minute_label:'descoberta',certainty:'CONFIRMADO',title:`Pista descoberta: ${clue.title}`,description:clue.description,source:target==='narrador'?'Central':mystery.characters.find((x:any)=>x.id===target)?.name||target,visible_to:'shared'})
          ]);
        }
      }
    }
    const author = target === "narrador" ? "Central" : mystery.characters.find((item) => item.id === target)?.name || "Suspeito";
    const {data:savedMessage,error:savedError}=await db.from("messages").insert({ room_code: roomCode, thread_player_id: player.player_id, author, role: "character", target, content: reply }).select("id").single();
    throwIfError(savedError);

    if(taskRow&&usedTeacher){
      await Promise.allSettled([
        db.from('investigation_tasks').update({status:'completed',result_data:{summary:reply,source:'Central',messageId:savedMessage?.id||null},completed_at:new Date().toISOString()}).eq('id',taskRow.id).eq('room_code',roomCode),
        db.from('timeline_events').insert({room_code:roomCode,event_time:null,minute_label:'resultado recebido',certainty:'CONFIRMADO',title:`Resultado: ${taskRow.task_type}`,description:reply,source:'Central',visible_to:'shared'})
      ]);
    }

    if(psych){
      const validEvidence=evidenceWasValid(content,mystery,found);
      await evolveCharacterState(db,psych,{question:content,reply,culprit:target===mystery.solution.culpritId,validEvidence,revealedClue:revealClueKey||null}).catch(()=>null);
    }

    if(usedTeacher){
      const scores=heuristicLearningScores(content,reply);
      const learningInput=`Papel: ${target==='narrador'?'Central de investigação':target}\nPergunta do detetive: ${content}\nPistas já descobertas: ${found.join(', ')||'nenhuma'}\nContexto recente do MESMO alvo: ${(recent||[]).slice(-12).map((x:any)=>`${x.author}: ${x.content}`).join(' | ')}`;
      const jobs:Promise<unknown>[]=[recordTrainingExample({
        roomCode,sourceMessageId:savedMessage?.id||null,characterId:target==='narrador'?null:target,
        taskType:taskRow?'forensic_task':target==='narrador'?'investigation_action':'character_interrogation',inputText:learningInput,
        teacherOutput:reply,teacherModel:'gemini',importance:scores.importance,quality:scores.quality,novelty:scores.novelty,
        metadata:{difficulty:mystery.difficulty,target,revealedClue:revealClueKey||null,clueCount:found.length,psychologyPersistent:target!=='narrador',taskId:taskRow?.id||null}
      })];
      if(scores.importance>=55 || revealClueKey){
        jobs.push(rememberImportant({scope:'room',roomCode,characterId:target==='narrador'?null:target,memoryType:revealClueKey?'clue_interaction':taskRow?'forensic_result':'important_interaction',content:`Pergunta: ${content}\nResposta: ${reply}`,summary:revealClueKey?`Interação que revelou ${revealClueKey}`:taskRow?`Resultado de ${taskRow.task_type}`:`Interação relevante com ${target}`,importance:Math.max(scores.importance,revealClueKey?85:taskRow?80:0),confidence:scores.quality,metadata:{messageId:savedMessage?.id||null,target,revealClueKey:revealClueKey||null,taskId:taskRow?.id||null}}));
      }
      await Promise.allSettled(jobs);
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao interrogar." }, { status: 500 });
  }
}
