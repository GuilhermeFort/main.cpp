import { getSupabase } from '../../../lib/supabase';
import { decryptSecret } from '../../../lib/secrets';
import { generateMystery } from '../../../lib/gemini';

export const dynamic='force-dynamic';
export const maxDuration=60;

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
    const mystery=await generateMystery(apiKey,'dificil');
    return Response.json({ok:true,title:mystery.title,characters:mystery.characters.length,clues:mystery.clues.length,locations:(mystery as any).world?.locations?.length||0,devices:(mystery as any).world?.devices?.length||0,cameras:(mystery as any).world?.cameras?.length||0});
  }catch(error){
    return Response.json({ok:false,error:error instanceof Error?error.message:'smoke_error'},{status:500});
  }
}
