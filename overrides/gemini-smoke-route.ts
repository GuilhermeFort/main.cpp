import { getSupabase } from '../../../lib/supabase';
import { decryptSecret } from '../../../lib/secrets';

export const dynamic='force-dynamic';
export const maxDuration=60;

async function call(apiKey:string,payload:any){
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
    method:'POST',headers:{'x-goog-api-key':apiKey,'Content-Type':'application/json'},
    body:JSON.stringify(payload),signal:AbortSignal.timeout(55000)
  });
  const text=await r.text();
  return {status:r.status,ok:r.ok,text:text.slice(0,500)};
}

export async function GET(req:Request){
  try{
    const url=new URL(req.url);
    if(url.searchParams.get('token')!=='smoke-427fa573') return Response.json({ok:false},{status:404});
    const code=(url.searchParams.get('code')||'8PPJBJ').trim().toUpperCase();
    const db=getSupabase();
    const {data:room,error}=await db.from('rooms').select('api_key_cipher').eq('code',code).maybeSingle();
    if(error) throw error;
    const apiKey=room?.api_key_cipher?await decryptSecret(room.api_key_cipher):process.env.GEMINI_API_KEY;
    if(!apiKey) throw new Error('Sem API key do Gemini para smoke test.');

    const base={model:'gemini-3.6-flash',input:'Retorne um JSON simples.'};
    const token6500=await call(apiKey,{...base,generation_config:{max_output_tokens:6500}});
    const jsonNoSchema=await call(apiKey,{...base,response_format:{type:'text',mime_type:'application/json'}});
    const combined=await call(apiKey,{...base,system_instruction:'Você é um motor narrativo de investigação. Mantenha a verdade fixa e responda em JSON.',generation_config:{max_output_tokens:6500}});
    const all=await call(apiKey,{...base,system_instruction:'Você é um motor narrativo de investigação. Mantenha a verdade fixa e responda em JSON.',generation_config:{max_output_tokens:6500},response_format:{type:'text',mime_type:'application/json'}});
    return Response.json({ok:true,token6500,jsonNoSchema,combined,all});
  }catch(error){
    return Response.json({ok:false,error:error instanceof Error?error.message:'smoke_error'},{status:500});
  }
}
