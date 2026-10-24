import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";
export function adminSupabase() {
  const key=process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('Server Supabase secret is not configured.');
  return createClient(supabaseConfig().url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
