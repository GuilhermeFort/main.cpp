import { getSupabase, throwIfError } from '../../../lib/supabase';
import { readCase } from '../../../lib/case';
export const dynamic='force-dynamic';

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
    const [locations,devices,artifacts,cameras,events,nodes,edges,legal,assessments]=await Promise.all([
      db.from('case_locations').select('id,location_key,name,kind,description,x,y,discovered').eq('room_code',room).eq('discovered',true).order('id'),
      db.from('digital_devices').select('id,device_key,owner_character_id,device_type,label,description,seized,unlocked,discovered,public_metadata').eq('room_code',room).eq('discovered',true).order('id'),
      db.from('digital_artifacts').select('id,device_key,artifact_key,artifact_type,title,content,minute_label,source,reliability,metadata').eq('room_code',room).eq('discovered',true).order('id'),
      db.from('surveillance_cameras').select('id,camera_key,name,location_key,angle_description,has_audio,clock_offset_seconds,quality,status,discovered').eq('room_code',room).eq('discovered',true).order('id'),
      db.from('camera_events').select('id,camera_key,event_key,minute_label,description,visible_details,confidence,metadata').eq('room_code',room).eq('discovered',true).order('id'),
      db.from('investigation_board_nodes').select('*').eq('room_code',room).or(`shared.eq.true,owner_player_id.eq.${playerId}`).order('id'),
      db.from('investigation_board_edges').select('*').eq('room_code',room).or(`shared.eq.true,owner_player_id.eq.${playerId}`).order('id'),
      db.from('legal_requests').select('*').eq('room_code',room).order('created_at',{ascending:false}),
      db.from('case_assessments').select('id,submitted_by,accused_character_id,motive,method,evidence_codes,timeline_summary,score,outcome,created_at').eq('room_code',room).eq('submitted_by',playerId).order('created_at',{ascending:false}).limit(5)
    ]);[locations,devices,artifacts,cameras,events,nodes,edges,legal,assessments].forEach((x:any)=>throwIfError(x.error));
    return Response.json({ok:true,locations:locations.data||[],devices:devices.data||[],artifacts:artifacts.data||[],cameras:cameras.data||[],cameraEvents:events.data||[],boardNodes:nodes.data||[],boardEdges:edges.data||[],legalRequests:legal.data||[],assessments:assessments.data||[]});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Erro ao carregar mundo.'},{status:500})}
}

function hasApproved(legal:any[],target:string){return legal.some(x=>x.status==='approved'&&x.target===target)}

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
      const accused=String(body.accusedCharacterId||''),solution=ctx.mystery.solution||{},correct=accused===solution.culpritId;
      const text=(String(body.motive||'')+' '+String(body.method||'')).toLowerCase();
      const motiveWords=String(solution.motive||'').toLowerCase().split(/\W+/).filter((x:string)=>x.length>4),methodWords=String(solution.method||'').toLowerCase().split(/\W+/).filter((x:string)=>x.length>4);
      const overlap=(words:string[])=>words.length?Math.round(100*words.filter(w=>text.includes(w)).length/words.length):0;
      const {count}=await db.from('evidence_items').select('id',{count:'exact',head:true}).eq('room_code',room).eq('discovered',true);
      const score={culprit:correct?100:0,motive:overlap(motiveWords),method:overlap(methodWords),evidenceCoverage:Math.min(100,(body.evidenceCodes||[]).length*15),discoveredEvidence:count||0};
      const outcome=correct&&score.motive>=20&&score.method>=20?'sustained':'insufficient';
      const {data,error}=await db.from('case_assessments').insert({room_code:room,submitted_by:playerId,accused_character_id:accused,motive:body.motive||'',method:body.method||'',evidence_codes:body.evidenceCodes||[],timeline_summary:body.timelineSummary||'',score,outcome}).select('id,score,outcome,created_at').single();throwIfError(error);return Response.json({ok:true,result:data});
    }
    return Response.json({error:'Ação desconhecida.'},{status:400});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Erro no mundo investigativo.'},{status:500})}
}
