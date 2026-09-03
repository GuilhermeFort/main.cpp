import { getSupabase, throwIfError } from "../../../lib/supabase";
import { readCase } from "../../../lib/case";
import { answerMystery } from "../../../lib/gemini";
import { decryptSecret } from "../../../lib/secrets";
import { heuristicLearningScores, recordTrainingExample, rememberImportant } from "../../../lib/learning";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { code?: string; playerId?: string; target?: string; content?: string };
    const roomCode = body.code?.trim().toUpperCase() || "";
    const content = body.content?.trim().slice(0, 500) || "";
    if (!roomCode || !body.playerId || !content) return Response.json({ error: "Pergunta inválida." }, { status: 400 });
    const db = getSupabase();
    const [{ data: room, error: roomError }, { data: player, error: playerError }] = await Promise.all([
      db.from("rooms").select("*").eq("code", roomCode).maybeSingle(),
      db.from("players").select("*").eq("room_code", roomCode).eq("player_id", body.playerId).maybeSingle(),
    ]);
    throwIfError(roomError); throwIfError(playerError);
    if (!room || !player) return Response.json({ error: "Sessão inválida." }, { status: 403 });
    const mystery = readCase(room.case_data);
    const target = body.target === "narrador" || mystery.characters.some((item) => item.id === body.target) ? body.target! : "narrador";
    throwIfError((await db.from("messages").insert({ room_code: roomCode, thread_player_id: player.player_id, author: player.name, role: "detective", target, content })).error);
    const [{ data: foundRows, error: foundError }, { data: recent, error: recentError }] = await Promise.all([
      db.from("discovered_clues").select("clue_key").eq("room_code", roomCode),
      db.from("messages").select("author,content,id").eq("room_code", roomCode).order("id", { ascending: true }).limit(40),
    ]);
    throwIfError(foundError); throwIfError(recentError);
    const found = (foundRows || []).map((item) => item.clue_key);
    const history = (recent || []).slice(-10).map((item) => `${item.author}: ${item.content}`).join(" | ");
    const apiKey = room.api_key_cipher ? await decryptSecret(room.api_key_cipher) : process.env.GEMINI_API_KEY;
    let reply: string; let revealClueKey: string | null | undefined;
    let usedTeacher=false;
    if (apiKey) {
      const result = await answerMystery(apiKey, mystery, target, history, found, content);
      reply = result.reply!; revealClueKey = result.revealClueKey; usedTeacher=true;
    } else {
      const character = mystery.characters.find((item) => item.id === target);
      reply = target === "narrador" ? `A Central registrou sua pergunta. Configure o Gemini para investigar este caso de forma livre. Por enquanto, concentrem-se em: ${mystery.objective}` : `${character?.name || "O suspeito"} observa vocês em silêncio. Configure o Gemini para iniciar o interrogatório livre.`;
    }
    if (revealClueKey && mystery.clues.some((clue) => clue.key === revealClueKey)) {
      const { error } = await db.from("discovered_clues").upsert({ room_code: roomCode, clue_key: revealClueKey, discovered_by: player.player_id }, { onConflict: "room_code,clue_key", ignoreDuplicates: true });
      throwIfError(error);
    }
    const author = target === "narrador" ? "Central" : mystery.characters.find((item) => item.id === target)?.name || "Suspeito";
    const {data:savedMessage,error:savedError}=await db.from("messages").insert({ room_code: roomCode, thread_player_id: player.player_id, author, role: "character", target, content: reply }).select("id").single();
    throwIfError(savedError);

    // Gemini funciona como professor: capturamos somente interações reais do professor.
    // O filtro em learning.ts decide se o exemplo merece entrar no dataset.
    if(usedTeacher){
      const scores=heuristicLearningScores(content,reply);
      const learningInput=`Papel: ${target==='narrador'?'Central de investigação':target}\nPergunta do detetive: ${content}\nPistas já descobertas: ${found.join(', ')||'nenhuma'}\nContexto recente: ${history}`;
      const jobs:Promise<unknown>[]=[recordTrainingExample({
        roomCode,sourceMessageId:savedMessage?.id||null,characterId:target==='narrador'?null:target,
        taskType:target==='narrador'?'investigation_action':'character_interrogation',inputText:learningInput,
        teacherOutput:reply,teacherModel:'gemini',importance:scores.importance,quality:scores.quality,novelty:scores.novelty,
        metadata:{difficulty:mystery.difficulty,target,revealedClue:revealClueKey||null,clueCount:found.length}
      })];
      if(scores.importance>=55 || revealClueKey){
        jobs.push(rememberImportant({scope:'room',roomCode,characterId:target==='narrador'?null:target,memoryType:revealClueKey?'clue_interaction':'important_interaction',content:`Pergunta: ${content}\nResposta: ${reply}`,summary:revealClueKey?`Interação que revelou ${revealClueKey}`:`Interação relevante com ${target}`,importance:Math.max(scores.importance,revealClueKey?85:0),confidence:scores.quality,metadata:{messageId:savedMessage?.id||null,target,revealClueKey:revealClueKey||null}}));
      }
      await Promise.allSettled(jobs);
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao interrogar." }, { status: 500 });
  }
}
