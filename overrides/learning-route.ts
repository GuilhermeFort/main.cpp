import { NextRequest, NextResponse } from 'next/server';
import { learningMetrics, pruneLearningData, recordTrainingExample, rememberImportant } from '../../../lib/learning';
import { getSupabase } from '../../../lib/supabase';

function authorized(req:NextRequest){
  const secret=process.env.LEARNING_INTERNAL_KEY;
  return !secret || req.headers.get('x-learning-internal')===secret;
}

export async function GET(req:NextRequest){
  try{
    if(!authorized(req))return NextResponse.json({error:'unauthorized'},{status:401});
    const metrics=await learningMetrics();
    return NextResponse.json({ok:true,metrics});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||'learning_error'},{status:500})}
}

export async function POST(req:NextRequest){
  try{
    if(!authorized(req))return NextResponse.json({error:'unauthorized'},{status:401});
    const body=await req.json();
    if(body.action==='record_example')return NextResponse.json({ok:true,result:await recordTrainingExample(body.example)});
    if(body.action==='remember')return NextResponse.json({ok:true,result:await rememberImportant(body.memory)});
    if(body.action==='feedback'){
      const supabase=getSupabase();
      const {data,error}=await supabase.from('ai_feedback').insert({training_example_id:body.trainingExampleId||null,room_code:body.roomCode||null,evaluator:body.evaluator||'gemini_teacher',verdict:body.verdict||'review',score:body.score??null,critique:body.critique||null,preferred_answer:body.preferredAnswer||null,tags:body.tags||[]}).select('id').single();
      if(error)throw error;return NextResponse.json({ok:true,result:data});
    }
    if(body.action==='prune')return NextResponse.json({ok:true,result:await pruneLearningData(body.days||30)});
    return NextResponse.json({ok:false,error:'unknown_action'},{status:400});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||'learning_error'},{status:500})}
}
