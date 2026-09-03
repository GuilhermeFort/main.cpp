import { getSupabase } from '../../../lib/supabase';
import { decryptSecret } from '../../../lib/secrets';
import { answerMystery } from '../../../lib/gemini';

export const dynamic='force-dynamic';
export const maxDuration=60;

export async function GET(req:Request){
  try{
    const url=new URL(req.url);
    if(url.searchParams.get('token')!=='smoke-427fa573') return Response.json({ok:false},{status:404});
    const code=(url.searchParams.get('code')||'8PPJBJ').trim().toUpperCase();
    const db=getSupabase();
    const {data:room,error}=await db.from('rooms').select('api_key_cipher,case_data').eq('code',code).maybeSingle();
    if(error) throw error;
    const apiKey=room?.api_key_cipher?await decryptSecret(room.api_key_cipher):process.env.GEMINI_API_KEY;
    if(!apiKey) throw new Error('Sem API key do Gemini para smoke test.');
    if(!room?.case_data) throw new Error('Sala sem caso salvo.');
    const mystery=JSON.parse(room.case_data);
    const result=await answerMystery(apiKey,mystery,'helena','',[],'Onde você estava na hora do crime?');
    return Response.json({ok:true,reply:result.reply,revealClueKey:result.revealClueKey||null});
  }catch(error){
    return Response.json({ok:false,error:error instanceof Error?error.message:'smoke_error'},{status:500});
  }
}
