import {NextResponse} from 'next/server';
import {serverSupabase} from '@/lib/supabase/server';
import {supabaseConfig} from '@/lib/supabase/config';
import {providerAvailability} from '@/lib/oauth-providers';
import {sameOrigin} from '@/lib/auth-security';
import {boundedJson} from '@/lib/request-body';
import {onboardingPath} from '@/lib/auth-flow';
export async function POST(request:Request){
 const headers={'Cache-Control':'private, no-store'};
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid origin'},{status:403,headers});
 try{const {provider,business}=await boundedJson(request);
  if(provider!=='google'&&provider!=='facebook')return NextResponse.json({error:'Choose Google or Facebook.'},{status:400,headers});
  const status=(await providerAvailability())[provider as 'google'|'facebook'];
  if(status!=='enabled')return NextResponse.json({error:status==='disabled'?`${provider==='google'?'Google':'Facebook'} sign-in is not configured yet. Use email or contact support.`:'Social sign-in availability could not be checked. Use email or try again later.'},{status:503,headers});
  const origin=new URL(request.url).origin,client=await serverSupabase();
  const {data,error}=await client.auth.signInWithOAuth({provider,options:{redirectTo:`${origin}/auth/callback?next=${encodeURIComponent(onboardingPath(business===true))}`,skipBrowserRedirect:true,...(provider==='facebook'?{scopes:'email'}:{})}});
  if(error||!data.url)throw new Error('Social sign-in could not start. Please try email sign-in.');
  const target=new URL(data.url);
  if(target.origin!==new URL(supabaseConfig().url).origin||target.pathname!=='/auth/v1/authorize'||target.searchParams.get('provider')!==provider)throw new Error('Unexpected sign-in destination');
  return NextResponse.json({url:target.toString()},{headers});
 }catch{return NextResponse.json({error:'Social sign-in could not start. Please try email sign-in.'},{status:503,headers});}
}
