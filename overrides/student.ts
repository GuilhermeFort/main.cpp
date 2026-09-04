import { getSupabase } from './supabase';

const tokens=(s:string)=>new Set(String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>3));
function similarity(a:string,b:string){const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let both=0;for(const x of A)if(B.has(x))both++;return both/Math.max(A.size,B.size);}

async function localStudent(input:string){
  const db=getSupabase();
  const {data,error}=await db.from('ai_training_ready').select('id,input_text,teacher_output,corrected_output,quality_score,importance_score').order('quality_score',{ascending:false}).limit(250);
  if(error||!data?.length)return null;
  let best:any=null,bestScore=0;
  for(const row of data){const score=similarity(input,row.input_text);if(score>bestScore){bestScore=score;best=row}}
  if(!best||bestScore<0.48)return null;
  const output=String(best.corrected_output||best.teacher_output||'').trim();if(!output)return null;
  return {output,similarity:bestScore,sourceExampleId:best.id};
}

export async function runStudentShadow(input:string,teacherOutput:string,exampleId?:number|null){
  const url=process.env.STUDENT_MODEL_URL,apiKey=process.env.STUDENT_MODEL_API_KEY;
  try{
    let studentOutput='',method='',sourceExampleId:null|number=null;
    if(url){
      const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(apiKey?{'Authorization':`Bearer ${apiKey}`}:{})},body:JSON.stringify({input,mode:'investigation_response'}),signal:AbortSignal.timeout(18000)});
      if(!response.ok)return {enabled:true,ok:false,status:response.status,method:'remote'};
      const data=await response.json() as any;studentOutput=String(data.output??data.response??data.text??'').trim();method='remote_model';
    }else{
      const local=await localStudent(input);if(!local)return {enabled:false,reason:'no_student_model_or_similar_memory'};
      studentOutput=local.output;sourceExampleId=local.sourceExampleId;method='local_retrieval_student';
    }
    if(!studentOutput)return {enabled:true,ok:false,error:'empty_student_output',method};
    const teacherQuality=scoreText(teacherOutput),studentQuality=scoreText(studentOutput);
    const winner=studentQuality>teacherQuality+8?'student':teacherQuality>studentQuality+8?'teacher':'tie';
    const db=getSupabase();
    const {data:version}=await db.from('ai_model_versions').select('id').in('status',['shadow','candidate','production']).order('created_at',{ascending:false}).limit(1).maybeSingle();
    await db.from('ai_evaluations').insert({model_version_id:version?.id||null,example_id:exampleId||sourceExampleId||null,evaluator:method,student_output:studentOutput,teacher_output:teacherOutput,winner,score_student:studentQuality,score_teacher:teacherQuality,reasons:{method,sourceExampleId}});
    return {enabled:true,ok:true,studentOutput,winner,studentQuality,teacherQuality,method,sourceExampleId};
  }catch(error:any){return {enabled:true,ok:false,error:error?.message||'student_error'}}
}

function scoreText(text:string){
  let s=55;const t=String(text||'').trim();if(t.length>=20&&t.length<=900)s+=15;if(t.length<8)s-=35;if(/como ia|sou uma ia|prompt|json/i.test(t))s-=30;if(/[.!?]/.test(t))s+=5;if(t.split(/\s+/).length>8)s+=5;return Math.max(0,Math.min(100,s));
}
