import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";
export async function serverSupabase() {
  const jar = await cookies();
  const { url, key } = supabaseConfig();
  return createServerClient(url, key, { cookies: {
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
