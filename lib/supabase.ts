import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL || 'https://wdrzdpsphgumjcyyuasn.supabase.co';
const key = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_PPzOlWdjJDlFHYk612Fmmg_FXOtJYnS';
export const supabase = createClient(url, key, { auth: { persistSession:false, autoRefreshToken:false } });
export async function one<T=any>(query:PromiseLike<{data:any,error:any}>){const {data,error}=await query;if(error)throw error;return data as T;}
