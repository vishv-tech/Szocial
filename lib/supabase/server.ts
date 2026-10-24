import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type {RequestMetrics} from "@/lib/request-metrics";
import { supabaseConfig } from "./config";
export async function serverSupabase(options?:{onAuthResponse?:(response:Response)=>void;metrics?:RequestMetrics}) {
  const jar = await cookies();
  const { url, key } = supabaseConfig();
  return createServerClient(url, key, { global:{fetch:async(input,init)=>{const started=performance.now();const response=await fetch(input,{...init,signal:init?.signal??AbortSignal.timeout(20000)});options?.onAuthResponse?.(response);const path=new URL(typeof input==='string'?input:input instanceof URL?input.toString():input.url).pathname;options?.metrics?.record(path.startsWith('/auth/')?'auth':path.startsWith('/storage/')?'storage':'data',performance.now()-started);return response;}}, cookies: {
    getAll: () => jar.getAll(),
    setAll: entries => {
      try { entries.forEach(({name,value,options}) => jar.set(name,value,options)); }
      catch { /* Server Components cannot write; middleware refreshes cookies. */ }
    }
  } });
}
export class AccessError extends Error{constructor(message:string,public status:number){super(message);}}
export async function authenticatedClient(metrics?:RequestMetrics) {
  const client=await serverSupabase({metrics});
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user)throw new AccessError(error&&((error.status??0)>=500||error.name==='AuthRetryableFetchError')?'Authentication temporarily unavailable':'Authentication required',error&&((error.status??0)>=500||error.name==='AuthRetryableFetchError')?503:401);
  const {data:profile,error:profileError}=await client.from('profiles').select('account_status').eq('id',user.id).single();
  if(profileError&&profileError.code!=='PGRST116')throw new AccessError('Account verification temporarily unavailable',503);
  if(!profile||profile.account_status!=='Active')throw new AccessError('Account unavailable',403);
  return {client,user};
}
