import { getSupabase } from '../../../lib/supabase';
import { decryptSecret } from '../../../lib/secrets';
import { generateMystery } from '../../../lib/gemini';

export const maxDuration=60;
export const dynamic='force-dynamic';

export async function GET(){
  const started=Date.now();
  try{
    let apiKey=process.env.GEMINI_API_KEY||'';
    if(!apiKey){
      const db=getSupabase();
      const {data}=await db.from('rooms').select('api_key_cipher').not('api_key_cipher','is',null).order('created_at',{ascending:false}).limit(1).maybeSingle();
      if(data?.api_key_cipher) apiKey=await decryptSecret(data.api_key_cipher);
    }
    if(!apiKey) return Response.json({ok:false,error:'no_api_key'},{status:503});
    const mystery:any=await generateMystery(apiKey,'dificil');
    return Response.json({ok:true,ms:Date.now()-started,characters:mystery.characters?.length||0,clues:mystery.clues?.length||0,locations:mystery.world?.locations?.length||0,devices:mystery.world?.devices?.length||0,cameras:mystery.world?.cameras?.length||0,titleLength:String(mystery.title||'').length});
  }catch(error:any){
    return Response.json({ok:false,ms:Date.now()-started,error:error?.message||'generation_failed'},{status:500});
  }
}
