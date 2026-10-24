import 'server-only';
import {supabaseConfig} from '@/lib/supabase/config';
export type ProviderStatus='enabled'|'disabled'|'unknown';
export type Providers={google:ProviderStatus;facebook:ProviderStatus};
let cached:{expires:number;value:Providers}|undefined,inFlight:Promise<Providers>|undefined;
export async function providerAvailability():Promise<Providers>{
 if(cached&&cached.expires>Date.now())return cached.value;
 if(inFlight)return inFlight;
 inFlight=(async()=>{
  let value:Providers={google:'unknown',facebook:'unknown'};
  try{const {url,key}=supabaseConfig();const response=await fetch(`${url}/auth/v1/settings`,{headers:{apikey:key},cache:'no-store',signal:AbortSignal.timeout(5000)});
   if(response.ok){const data=await response.json();const state=(name:string):ProviderStatus=>data.external?.[name]===true?'enabled':data.external?.[name]===false?'disabled':'unknown';value={google:state('google'),facebook:state('facebook')};}
  }catch{/* Only public provider flags are returned; no configuration or credentials. */}
  cached={expires:Date.now()+30000,value};return value;
 })();try{return await inFlight;}finally{inFlight=undefined;}
}
