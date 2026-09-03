import { getSupabase, throwIfError } from '../../../lib/supabase';
export const dynamic='force-dynamic';

export async function GET(request:Request){
  try{
    const url=new URL(request.url),room=(url.searchParams.get('code')||'').trim().toUpperCase(),playerId=url.searchParams.get('playerId')||'';
    if(!room||!playerId)return Response.json({error:'Parâmetros inválidos.'},{status:400});
    const db=getSupabase();
    const {data:player,error:pErr}=await db.from('players').select('player_id').eq('room_code',room).eq('player_id',playerId).maybeSingle();throwIfError(pErr);
    if(!player)return Response.json({error:'Sessão inválida.'},{status:403});
    const [e,t,h,tasks,notes]=await Promise.all([
      db.from('evidence_items').select('*').eq('room_code',room).eq('discovered',true).order('id'),
      db.from('timeline_events').select('*').eq('room_code',room).order('event_time',{ascending:true,nullsFirst:false}),
      db.from('hypotheses').select('*').eq('room_code',room).or(`shared.eq.true,owner_player_id.eq.${playerId}`).order('updated_at',{ascending:false}),
      db.from('investigation_tasks').select('*').eq('room_code',room).order('created_at',{ascending:false}),
      db.from('player_private_notes').select('*').eq('room_code',room).eq('player_id',playerId).order('updated_at',{ascending:false})
    ]);
    [e,t,h,tasks,notes].forEach((x:any)=>throwIfError(x.error));
    return Response.json({ok:true,evidence:e.data||[],timeline:t.data||[],hypotheses:h.data||[],tasks:tasks.data||[],privateNotes:notes.data||[]});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Erro ao carregar investigação.'},{status:500})}
}

export async function POST(request:Request){
  try{
    const body=await request.json(); const room=(body.code||'').trim().toUpperCase(),playerId=body.playerId||''; if(!room||!playerId)return Response.json({error:'Dados inválidos.'},{status:400});
    const db=getSupabase(); const {data:player,error:pErr}=await db.from('players').select('player_id,name').eq('room_code',room).eq('player_id',playerId).maybeSingle();throwIfError(pErr); if(!player)return Response.json({error:'Sessão inválida.'},{status:403});
    if(body.action==='timeline'){
      const {data,error}=await db.from('timeline_events').insert({room_code:room,event_time:body.eventTime||null,minute_label:body.minuteLabel||null,certainty:body.certainty||'ALEGADO',title:String(body.title||'Evento').slice(0,140),description:String(body.description||'').slice(0,1500),source:body.source||player.name,visible_to:body.visibleTo||'shared'}).select('*').single();throwIfError(error);return Response.json({ok:true,result:data});
    }
    if(body.action==='hypothesis'){
      const payload={room_code:room,owner_player_id:playerId,title:String(body.title||'Hipótese').slice(0,140),theory:String(body.theory||'').slice(0,5000),supporting_evidence:body.supportingEvidence||[],contradicting_evidence:body.contradictingEvidence||[],open_questions:body.openQuestions||[],shared:!!body.shared,updated_at:new Date().toISOString()};
      if(body.id){const {data,error}=await db.from('hypotheses').update(payload).eq('id',body.id).eq('room_code',room).eq('owner_player_id',playerId).select('*').single();throwIfError(error);return Response.json({ok:true,result:data});}
      const {data,error}=await db.from('hypotheses').insert(payload).select('*').single();throwIfError(error);return Response.json({ok:true,result:data});
    }
    if(body.action==='private_note'){
      const payload={room_code:room,player_id:playerId,kind:body.kind||'note',title:String(body.title||'Nota').slice(0,140),content:String(body.content||'').slice(0,6000),source_message_id:body.sourceMessageId||null,updated_at:new Date().toISOString()};
      if(body.id){const {data,error}=await db.from('player_private_notes').update(payload).eq('id',body.id).eq('room_code',room).eq('player_id',playerId).select('*').single();throwIfError(error);return Response.json({ok:true,result:data});}
      const {data,error}=await db.from('player_private_notes').insert(payload).select('*').single();throwIfError(error);return Response.json({ok:true,result:data});
    }
    if(body.action==='task'){
      const {data,error}=await db.from('investigation_tasks').insert({room_code:room,requested_by:playerId,task_type:body.taskType||'analysis',target:body.target||null,status:'pending',request_data:body.requestData||{},result_data:{},ready_at:body.readyAt||null}).select('*').single();throwIfError(error);return Response.json({ok:true,result:data});
    }
    if(body.action==='custody'){
      const {data,error}=await db.from('custody_events').insert({room_code:room,evidence_code:body.evidenceCode,actor:player.name,action:body.custodyAction||'registrado',location:body.location||null,details:body.details||null}).select('*').single();throwIfError(error);return Response.json({ok:true,result:data});
    }
    return Response.json({error:'Ação desconhecida.'},{status:400});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Erro na investigação.'},{status:500})}
}
