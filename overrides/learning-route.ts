import { NextRequest, NextResponse } from 'next/server';
import { learningMetrics, pruneLearningData, recordTrainingExample, rememberImportant } from '../../../lib/learning';
import { getSupabase } from '../../../lib/supabase';

function privileged(req:NextRequest){const secret=process.env.LEARNING_INTERNAL_KEY;return !!secret&&req.headers.get('x-learning-internal')===secret;}

export async function GET(req:NextRequest){
  try{
    const mode=req.nextUrl.searchParams.get('mode')||'metrics',supabase=getSupabase();
    if(mode==='metrics'){
      const metrics=await learningMetrics();
      const [{data:versions},{data:evaluationRows}]=await Promise.all([
        supabase.from('ai_model_versions').select('id,model_name,version,base_model,status,dataset_size,eval_score,teacher_win_rate,created_at').order('created_at',{ascending:false}).limit(10),
        supabase.from('ai_evaluations').select('winner').order('created_at',{ascending:false}).limit(500)
      ]);
      const evals=evaluationRows||[],studentWins=evals.filter((x:any)=>x.winner==='student').length,teacherWins=evals.filter((x:any)=>x.winner==='teacher').length,ties=evals.filter((x:any)=>x.winner==='tie').length;
      return NextResponse.json({ok:true,metrics,shadow:{evaluations:evals.length,studentWins,teacherWins,ties},versions:versions||[]});
    }
    if(!privileged(req))return NextResponse.json({error:'unauthorized'},{status:401});
    if(mode==='export'){
      const limit=Math.min(10000,Math.max(1,Number(req.nextUrl.searchParams.get('limit')||5000)));
      const {data,error}=await supabase.from('ai_training_ready').select('id,task_type,input_text,teacher_output,corrected_output,metadata').order('id').limit(limit);if(error)throw error;
      const jsonl=(data||[]).map((x:any)=>JSON.stringify({id:x.id,task_type:x.task_type,input:x.input_text,output:x.corrected_output||x.teacher_output,metadata:x.metadata||{}})).join('\n');
      return new NextResponse(jsonl,{status:200,headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Content-Disposition':'attachment; filename="detetives-training.jsonl"'}});
    }
    if(mode==='review_queue'){
      const {data,error}=await supabase.from('ai_training_examples').select('id,task_type,input_text,teacher_output,corrected_output,importance_score,quality_score,novelty_score,keep_for_training,reviewed,created_at').eq('keep_for_training',true).eq('reviewed',false).order('importance_score',{ascending:false}).limit(100);if(error)throw error;return NextResponse.json({ok:true,items:data||[]});
    }
    return NextResponse.json({error:'unknown_mode'},{status:400});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||'learning_error'},{status:500})}
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json();
    if(body.action==='record_example')return NextResponse.json({ok:true,result:await recordTrainingExample(body.example)});
    if(body.action==='remember')return NextResponse.json({ok:true,result:await rememberImportant(body.memory)});
    if(!privileged(req))return NextResponse.json({error:'unauthorized'},{status:401});
    const supabase=getSupabase();
    if(body.action==='feedback'){
      const {data,error}=await supabase.from('ai_feedback').insert({training_example_id:body.trainingExampleId||null,room_code:body.roomCode||null,evaluator:body.evaluator||'gemini_teacher',verdict:body.verdict||'review',score:body.score??null,critique:body.critique||null,preferred_answer:body.preferredAnswer||null,tags:body.tags||[]}).select('id').single();
      if(error)throw error;return NextResponse.json({ok:true,result:data});
    }
    if(body.action==='review_example'){
      const patch={reviewed:true,corrected_output:body.correctedOutput||null,dataset_split:body.datasetSplit||'train',keep_for_training:body.keep!==false,rejection_reason:body.keep===false?(body.rejectionReason||'rejeitado na revisão'):null};
      const {data,error}=await supabase.from('ai_training_examples').update(patch).eq('id',body.id).select('id,reviewed,keep_for_training,dataset_split').single();if(error)throw error;return NextResponse.json({ok:true,result:data});
    }
    if(body.action==='create_model_version'){
      const {count}=await supabase.from('ai_training_ready').select('id',{count:'exact',head:true});
      const {data,error}=await supabase.from('ai_model_versions').insert({model_name:body.modelName||'detetives-student',version:body.version||new Date().toISOString(),base_model:body.baseModel||'unset',training_run_id:body.trainingRunId||null,status:body.status||'planned',dataset_size:count||0,notes:body.notes||null}).select('*').single();if(error)throw error;return NextResponse.json({ok:true,result:data});
    }
    if(body.action==='record_evaluation'){
      const {data,error}=await supabase.from('ai_evaluations').insert({model_version_id:body.modelVersionId||null,example_id:body.exampleId||null,evaluator:body.evaluator||'gemini_teacher',student_output:body.studentOutput||'',teacher_output:body.teacherOutput||'',winner:body.winner||'tie',score_student:body.scoreStudent??null,score_teacher:body.scoreTeacher??null,reasons:body.reasons||{}}).select('*').single();if(error)throw error;return NextResponse.json({ok:true,result:data});
    }
    if(body.action==='promote_model'){
      const {data:evals,error:eErr}=await supabase.from('ai_evaluations').select('winner,score_student').eq('model_version_id',body.modelVersionId);if(eErr)throw eErr;const rows=evals||[];if(rows.length<20)return NextResponse.json({ok:false,error:'São necessárias pelo menos 20 avaliações antes de promover.'},{status:409});
      const studentWins=rows.filter((x:any)=>x.winner==='student').length,ties=rows.filter((x:any)=>x.winner==='tie').length,avg=rows.reduce((a:number,x:any)=>a+Number(x.score_student||0),0)/rows.length,winRate=(studentWins+ties*.5)/rows.length;
      const status=winRate>=.7&&avg>=75?'candidate':'shadow';const {data,error}=await supabase.from('ai_model_versions').update({status,eval_score:avg,teacher_win_rate:(1-winRate)*100}).eq('id',body.modelVersionId).select('*').single();if(error)throw error;return NextResponse.json({ok:true,result:data,gate:{evaluations:rows.length,studentEffectiveWinRate:winRate,averageStudentScore:avg}});
    }
    if(body.action==='prune')return NextResponse.json({ok:true,result:await pruneLearningData(body.days||30)});
    return NextResponse.json({ok:false,error:'unknown_action'},{status:400});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||'learning_error'},{status:500})}
}
