import { getSupabase } from './supabase';

export async function runStudentShadow(input:string,teacherOutput:string,exampleId?:number|null){
  const url=process.env.STUDENT_MODEL_URL,apiKey=process.env.STUDENT_MODEL_API_KEY;
  if(!url)return {enabled:false};
  try{
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(apiKey?{'Authorization':`Bearer ${apiKey}`}:{})},body:JSON.stringify({input,mode:'investigation_response'}),signal:AbortSignal.timeout(20000)});
    if(!response.ok)return {enabled:true,ok:false,status:response.status};
    const data=await response.json() as any;
    const studentOutput=String(data.output??data.response??data.text??'').trim();if(!studentOutput)return {enabled:true,ok:false,error:'empty_student_output'};
    const teacherQuality=scoreText(teacherOutput),studentQuality=scoreText(studentOutput);
    const winner=studentQuality>teacherQuality+8?'student':teacherQuality>studentQuality+8?'teacher':'tie';
    const db=getSupabase();
    const {data:version}=await db.from('ai_model_versions').select('id').in('status',['shadow','candidate','production']).order('created_at',{ascending:false}).limit(1).maybeSingle();
    await db.from('ai_evaluations').insert({model_version_id:version?.id||null,example_id:exampleId||null,evaluator:'automatic_shadow',student_output:studentOutput,teacher_output:teacherOutput,winner,score_student:studentQuality,score_teacher:teacherQuality,reasons:{method:'structural_quality_v1'}});
    return {enabled:true,ok:true,studentOutput,winner,studentQuality,teacherQuality};
  }catch(error:any){return {enabled:true,ok:false,error:error?.message||'student_error'}}
}

function scoreText(text:string){
  let s=55;const t=String(text||'').trim();if(t.length>=20&&t.length<=900)s+=15;if(t.length<8)s-=35;if(/como ia|sou uma ia|prompt|json/i.test(t))s-=30;if(/[.!?]/.test(t))s+=5;if(t.split(/\s+/).length>8)s+=5;return Math.max(0,Math.min(100,s));
}
