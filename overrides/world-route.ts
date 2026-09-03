import { getSupabase, throwIfError } from '../../../lib/supabase';
import { readCase } from '../../../lib/case';
export const dynamic='force-dynamic';

const norm=(s:string)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
async function session(db:any,room:string,playerId:string){
  const [{data:player,error:pErr},{data:r,error:rErr}]=await Promise.all([
    db.from('players').select('player_id,name').eq('room_code',room).eq('player_id',playerId).maybeSingle(),
    db.from('rooms').select('case_data').eq('code',room).maybeSingle()
  ]);throwIfError(pErr);throwIfError(rErr);if(!player||!r)throw new Error('Sessão inválida.');return {player,roomRow:r,mystery:readCase(r.case_data) as any};
}

async function seedKnown(db:any,room:string,mystery:any){
  const world=mystery.world||{};
  for(const l of world.locations||[]){if(l.knownInitially!==false)await db.from('case_locations').upsert({room_code:room,location_key:l.key,name:l.name,kind:l.kind||'place',description:l.description||'',x:l.x??50,y:l.y??50,discovered:true,metadata:{}},{onConflict:'room_code,location_key'});}
  for(const d of world.devices||[]){if(d.knownInitially)await db.from('digital_devices').upsert({room_code:room,device_key:d.key,owner_character_id:d.ownerCharacterId||null,device_type:d.type,label:d.label,description:d.description||'',discovered:true,public_metadata:{requiresWarrant:!!d.requiresWarrant}},{onConflict:'room_code,device_key'});}
  for(const c of world.cameras||[]){if(c.knownInitially)await db.from('surveillance_cameras').upsert({room_code:room,camera_key:c.key,name:c.name,location_key:c.locationKey||null,angle_description:c.angleDescription||'',has_audio:!!c.hasAudio,clock_offset_seconds:c.clockOffsetSeconds||0,quality:c.quality||'medium',status:c.status||'online',discovered:true,metadata:{}},{onConflict:'room_code,camera_key'});}
}

export async function GET(request:Request){
  try{
    const u=new URL(request.url),room=(u.searchParams.get('code')||'').trim().toUpperCase(),playerId=u.searchParams.get('playerId')||'';
    if(!room||!playerId)return Response.json({error:'Parâmetros inválidos.'},{status:400});
    const db=getSupabase(),ctx=await session(db,room,playerId);await seedKnown(db,room,ctx.mystery);
    const [locations,devices,artifacts,cameras,events,nodes,edges,legal,assessments,searches,trials]=await Promise.all([
      db.from('case_locations').select('id,location_key,name,kind,description,x,y,discovered').eq('room_code',room).eq('discovered',true).order('id'),
      db.from('digital_devices').select('id,device_key,owner_character_id,device_type,label,description,seized,unlocked,discovered,public_metadata').eq('room_code',room).eq('discovered',true).order('id'),
      db.from('digital_artifacts').select('id,device_key,artifact_key,artifact_type,title,content,minute_label,source,reliability,metadata').eq('room_code',room).eq('discovered',true).order('id'),
      db.from('surveillance_cameras').select('id,camera_key,name,location_key,angle_description,has_audio,clock_offset_seconds,quality,status,discovered').eq('room_code',room).eq('discovered',true).order('id'),
      db.from('camera_events').select('id,camera_key,event_key,minute_label,description,visible_details,confidence,metadata').eq('room_code',room).eq('discovered',true).order('id'),
      db.from('investigation_board_nodes').select('*').eq('room_code',room).or(`shared.eq.true,owner_player_id.eq.${playerId}`).order('id'),
      db.from('investigation_board_edges').select('*').eq('room_code',room).or(`shared.eq.true,owner_player_id.eq.${playerId}`).order('id'),
      db.from('legal_requests').select('*').eq('room_code',room).order('created_at',{ascending:false}),
      db.from('case_assessments').select('id,submitted_by,accused_character_id,motive,method,evidence_codes,timeline_summary,score,outcome,created_at').eq('room_code',room).eq('submitted_by',playerId).order('created_at',{ascending:false}).limit(5),
      db.from('location_searches').select('*').eq('room_code',room).order('created_at',{ascending:false}),
      db.from('trial_sessions').select('*').eq('room_code',room).eq('submitted_by',playerId).order('created_at',{ascending:false}).limit(5)
    ]);[locations,devices,artifacts,cameras,events,nodes,edges,legal,assessments,searches,trials].forEach((x:any)=>throwIfError(x.error));
    const characters=(ctx.mystery.characters||[]).filter((c:any)=>c.kind==='suspect').map((c:any)=>({id:c.id,name:c.name,role:c.role,kind:c.kind}));
    return Response.json({ok:true,characters,locations:locations.data||[],devices:devices.data||[],artifacts:artifacts.data||[],cameras:cameras.data||[],cameraEvents:events.data||[],boardNodes:nodes.data||[],boardEdges:edges.data||[],legalRequests:legal.data||[],assessments:assessments.data||[],locationSearches:searches.data||[],trials:trials.data||[]});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Erro ao carregar mundo.'},{status:500})}
}

function hasApproved(legal:any[],target:string){return legal.some(x=>x.status==='approved'&&x.target===target)}
async function revealClue(db:any,room:string,player:any,mystery:any,clue:any,source:string){
  await db.from('discovered_clues').upsert({room_code:room,clue_key:clue.key,discovered_by:player.player_id},{onConflict:'room_code,clue_key',ignoreDuplicates:true});
  const code=`CLUE-${clue.key}`;const {data:ex}=await db.from('evidence_items').select('id').eq('room_code',room).eq('evidence_code',code).maybeSingle();
  if(!ex){await db.from('evidence_items').insert({room_code:room,evidence_code:code,title:clue.title,description:clue.description,category:'physical_search',source_type:'location_search',collected_by:player.name,collected_at:new Date().toISOString(),reliability:85,canonical_fact:{clueKey:clue.key},discovered:true,discovered_by:player.player_id});await db.from('custody_events').insert({room_code:room,evidence_code:code,actor:player.name,action:'coletada em busca',details:source});}
  return code;
}

export async function POST(request:Request){
  try{
    const body=await request.json(),room=(body.code||'').trim().toUpperCase(),playerId=body.playerId||'';if(!room||!playerId)return Response.json({error:'Dados inválidos.'},{status:400});
    const db=getSupabase(),ctx=await session(db,room,playerId),world=ctx.mystery.world||{};
    await seedKnown(db,room,ctx.mystery);
    if(body.action==='discover_device'){
      const d=(world.devices||[]).find((x:any)=>x.key===body.deviceKey);if(!d)return Response.json({error:'Dispositivo não existe no caso.'},{status:404});
      const {data,error}=await db.from('digital_devices').upsert({room_code:room,device_key:d.key,owner_character_id:d.ownerCharacterId||null,device_type:d.type,label:d.label,description:d.description||'',discovered:true,public_metadata:{requiresWarrant:!!d.requiresWarrant}},{onConflict:'room_code,device_key'}).select('*').single();throwIfError(error);return Response.json({ok:true,result:data});
    }
    if(body.action==='extract_device'){
      const d=(world.devices||[]).find((x:any)=>x.key===body.deviceKey);if(!d)return Response.json({error:'Dispositivo não existe no caso.'},{status:404});
      const {data:legal,error:lErr}=await db.from('legal_requests').select('status,target').eq('room_code',room);throwIfError(lErr);
      if(d.requiresWarrant&&!hasApproved(legal||[],d.key))return Response.json({error:'Este dispositivo exige autorização aprovada antes da extração.'},{status:403});
      await db.from('digital_devices').upsert({room_code:room,device_key:d.key,owner_character_id:d.ownerCharacterId||null,device_type:d.type,label:d.label,description:d.description||'',seized:true,unlocked:true,discovered:true,public_metadata:{requiresWarrant:!!d.requiresWarrant}},{onConflict:'room_code,device_key'});
      let count=0;for(const a of d.artifacts||[]){const {error}=await db.from('digital_artifacts').upsert({room_code:room,device_key:d.key,artifact_key:a.key,artifact_type:a.type,title:a.title,content:a.content||'',minute_label:a.minuteLabel||null,source:a.source||d.label,discovered:true,reliability:a.reliability??90,metadata:{}},{onConflict:'room_code,artifact_key'});if(!error){count++;await db.from('timeline_events').insert({room_code:room,minute_label:a.minuteLabel||null,certainty:'CONFIRMADO',title:a.title,description:a.content||'',source:`Perícia digital: ${d.label}`,visible_to:'shared'});}}
      await db.from('investigation_tasks').insert({room_code:room,requested_by:playerId,task_type:'digital_forensics',target:d.key,status:'completed',request_data:{deviceKey:d.key},result_data:{artifactsRecovered:count},ready_at:new Date().toISOString()});
      return Response.json({ok:true,result:{artifactsRecovered:count}});
    }
    if(body.action==='review_camera'){
      const c=(world.cameras||[]).find((x:any)=>x.key===body.cameraKey);if(!c)return Response.json({error:'Câmera não existe no caso.'},{status:404});
      await db.from('surveillance_cameras').upsert({room_code:room,camera_key:c.key,name:c.name,location_key:c.locationKey||null,angle_description:c.angleDescription||'',has_audio:!!c.hasAudio,clock_offset_seconds:c.clockOffsetSeconds||0,quality:c.quality||'medium',status:c.status||'online',discovered:true,metadata:{}},{onConflict:'room_code,camera_key'});
      let count=0;for(const ev of c.events||[]){const {error}=await db.from('camera_events').upsert({room_code:room,camera_key:c.key,event_key:ev.key,minute_label:ev.minuteLabel||null,description:ev.description,visible_details:ev.visibleDetails||'',discovered:true,confidence:ev.confidence??80,metadata:{clockOffsetSeconds:c.clockOffsetSeconds||0,quality:c.quality||'medium'}},{onConflict:'room_code,event_key'});if(!error){count++;await db.from('timeline_events').insert({room_code:room,minute_label:ev.minuteLabel||null,certainty:'CONFIRMADO',title:`Câmera: ${c.name}`,description:ev.description,source:c.name,visible_to:'shared'});}}
      return Response.json({ok:true,result:{eventsRecovered:count}});
    }
    if(body.action==='search_location'){
      const loc=(world.locations||[]).find((x:any)=>x.key===body.locationKey);if(!loc)return Response.json({error:'Local não existe neste caso.'},{status:404});
      const area=String(body.area||'área geral').slice(0,120),kind=norm(loc.kind+' '+loc.name),protectedPlace=/resid|apart|casa|quarto|escritorio privado/.test(kind);
      if(protectedPlace){const {data:legal}=await db.from('legal_requests').select('status,target').eq('room_code',room);if(!hasApproved(legal||[],loc.key))return Response.json({error:'Este local exige autorização aprovada para busca.'},{status:403});}
      const already=(await db.from('location_searches').select('id').eq('room_code',room).eq('location_key',loc.key).eq('area_key',norm(area)).maybeSingle()).data;if(already)return Response.json({error:'Esta área já foi examinada.'},{status:409});
      const needle=[loc.key,loc.name,area].map(norm).filter((x:string)=>x.length>2);const foundRows=(await db.from('discovered_clues').select('clue_key').eq('room_code',room)).data||[];const foundKeys=new Set(foundRows.map((x:any)=>x.clue_key));
      const matches=(ctx.mystery.clues||[]).filter((c:any)=>!foundKeys.has(c.key)&&needle.some((n:string)=>norm(`${c.title} ${c.description} ${c.hiddenTruth}`).includes(n))).slice(0,2);
      const results:string[]=[];for(const clue of matches)results.push(await revealClue(db,room,ctx.player,ctx.mystery,clue,`Busca em ${loc.name} / ${area}`));
      await db.from('location_searches').insert({room_code:room,location_key:loc.key,area_key:norm(area),searched_by:playerId,results});
      await db.from('timeline_events').insert({room_code:room,minute_label:'busca',certainty:'CONFIRMADO',title:`Busca: ${loc.name}`,description:results.length?`${results.length} item(ns) relevante(s) coletado(s) em ${area}.`:`Nenhum vestígio relevante encontrado em ${area}.`,source:ctx.player.name,visible_to:'shared'});
      return Response.json({ok:true,result:{location:loc.name,area,evidenceCodes:results,found:results.length}});
    }
    if(body.action==='board_node'){
      const nodeKey=body.nodeKey||`manual-${crypto.randomUUID()}`;const {data,error}=await db.from('investigation_board_nodes').upsert({room_code:room,owner_player_id:playerId,node_key:nodeKey,node_type:body.nodeType||'note',title:String(body.title||'Nó').slice(0,120),subtitle:String(body.subtitle||'').slice(0,300),x:Number(body.x??120),y:Number(body.y??120),shared:body.shared!==false,metadata:body.metadata||{},updated_at:new Date().toISOString()},{onConflict:'room_code,node_key'}).select('*').single();throwIfError(error);return Response.json({ok:true,result:data});
    }
    if(body.action==='board_edge'){
      const {data,error}=await db.from('investigation_board_edges').insert({room_code:room,owner_player_id:playerId,from_node_key:body.from,to_node_key:body.to,label:String(body.label||'').slice(0,120),edge_type:body.edgeType||'possible',shared:body.shared!==false,metadata:{}}).select('*').single();throwIfError(error);return Response.json({ok:true,result:data});
    }
    if(body.action==='legal_request'){
      const type=body.requestType||'search',target=String(body.target||''),justification=String(body.justification||'').trim();
      const {count,error:cErr}=await db.from('evidence_items').select('id',{count:'exact',head:true}).eq('room_code',room).eq('discovered',true);throwIfError(cErr);
      const strong=(count||0)>=2&&justification.length>=40,status=strong?'approved':'denied',reason=strong?'Há indícios documentados suficientes no contexto ficcional do caso.':'Justificativa insuficiente ou poucos indícios oficialmente descobertos.';
      const {data,error}=await db.from('legal_requests').insert({room_code:room,requested_by:playerId,request_type:type,target,justification,status,decision_reason:reason,decided_at:new Date().toISOString()}).select('*').single();throwIfError(error);return Response.json({ok:true,result:data});
    }
    if(body.action==='assessment'){
      const raw=String(body.accusedCharacterId||'').trim(),character=(ctx.mystery.characters||[]).find((c:any)=>c.id===raw||norm(c.name)===norm(raw));if(!character)return Response.json({error:'Suspeito não encontrado no caso.'},{status:404});
      const accused=character.id,solution=ctx.mystery.solution||{},correct=accused===solution.culpritId;
      const text=(String(body.motive||'')+' '+String(body.method||'')).toLowerCase();
      const motiveWords=String(solution.motive||'').toLowerCase().split(/\W+/).filter((x:string)=>x.length>4),methodWords=String(solution.method||'').toLowerCase().split(/\W+/).filter((x:string)=>x.length>4);
      const overlap=(words:string[])=>words.length?Math.round(100*words.filter(w=>text.includes(w)).length/words.length):0;
      const {count}=await db.from('evidence_items').select('id',{count:'exact',head:true}).eq('room_code',room).eq('discovered',true);
      const score={culprit:correct?100:0,motive:overlap(motiveWords),method:overlap(methodWords),evidenceCoverage:Math.min(100,(body.evidenceCodes||[]).length*15),discoveredEvidence:count||0};
      const outcome=correct&&score.motive>=20&&score.method>=20&&score.evidenceCoverage>=30?'sustained':'insufficient';
      const {data,error}=await db.from('case_assessments').insert({room_code:room,submitted_by:playerId,accused_character_id:accused,motive:body.motive||'',method:body.method||'',evidence_codes:body.evidenceCodes||[],timeline_summary:body.timelineSummary||'',score,outcome}).select('id,score,outcome,created_at,accused_character_id').single();throwIfError(error);return Response.json({ok:true,result:data});
    }
    if(body.action==='prosecutor_review'){
      const {data:a,error}=await db.from('case_assessments').select('*').eq('id',body.assessmentId).eq('room_code',room).eq('submitted_by',playerId).maybeSingle();throwIfError(error);if(!a)return Response.json({error:'Acusação não encontrada.'},{status:404});
      const s=a.score||{},challenges:string[]=[];if((s.culprit||0)<100)challenges.push('A autoria indicada não está sustentada pela verdade do caso.');if((s.motive||0)<35)challenges.push('O motivo está pouco demonstrado.');if((s.method||0)<35)challenges.push('O método ainda possui lacunas.');if((s.evidenceCoverage||0)<45)challenges.push('Poucas evidências foram vinculadas formalmente à acusação.');if((s.discoveredEvidence||0)<4)challenges.push('A investigação ainda possui baixa cobertura de evidências.');if(!challenges.length)challenges.push('A acusação está consistente; prepare-se para a defesa atacar confiabilidade, cadeia de custódia e interpretações alternativas.');
      const prosecution=Math.round(((s.culprit||0)+(s.motive||0)+(s.method||0)+(s.evidenceCoverage||0))/4),defense=Math.max(10,100-prosecution+Math.min(20,challenges.length*4));
      const {data,error:tErr}=await db.from('trial_sessions').insert({room_code:room,submitted_by:playerId,assessment_id:a.id,stage:'prosecutor',prosecution_score:prosecution,defense_score:defense,challenges,verdict:null}).select('*').single();throwIfError(tErr);return Response.json({ok:true,result:data});
    }
    if(body.action==='trial'){
      const {data:t,error}=await db.from('trial_sessions').select('*').eq('id',body.trialId).eq('room_code',room).eq('submitted_by',playerId).maybeSingle();throwIfError(error);if(!t)return Response.json({error:'Sessão não encontrada.'},{status:404});
      const {data:a}=await db.from('case_assessments').select('*').eq('id',t.assessment_id).maybeSingle();if(!a)return Response.json({error:'Acusação vinculada não encontrada.'},{status:404});
      const verdict=a.outcome==='sustained'&&t.prosecution_score>=60&&t.prosecution_score>t.defense_score?'culpado_provado':'absolvido_por_insuficiencia';
      const {data,error:uErr}=await db.from('trial_sessions').update({stage:'trial',verdict}).eq('id',t.id).select('*').single();throwIfError(uErr);return Response.json({ok:true,result:data});
    }
    return Response.json({error:'Ação desconhecida.'},{status:400});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Erro no mundo investigativo.'},{status:500})}
}
