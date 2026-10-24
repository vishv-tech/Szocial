import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";
export async function serverSupabase(options?:{onAuthResponse?:(response:Response)=>void}) {
  const jar = await cookies();
  const { url, key } = supabaseConfig();
  return createServerClient(url, key, { global:{fetch:async(input,init)=>{const response=await fetch(input,{...init,signal:init?.signal??AbortSignal.timeout(20000)});options?.onAuthResponse?.(response);return response;}}, cookies: {
    getAll: () => jar.getAll(),
    setAll: entries => {
      try { entries.forEach(({name,value,options}) => jar.set(name,value,options)); }
      catch { /* Server Components cannot write; middleware refreshes cookies. */ }
    }
  } });
}
export async function authenticatedClient() {
  const client = await serverSupabase();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error("Authentication required");
  const { data: profile } = await client.from("profiles").select("account_status").eq("id",user.id).single();
  if (!profile || profile.account_status !== "Active") throw new Error("Account unavailable");
  return { client, user };
}
