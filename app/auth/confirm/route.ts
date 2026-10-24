import {NextResponse} from 'next/server';
import {serverSupabase} from '@/lib/supabase/server';
import {authDestination} from '@/lib/auth-destination';
import {clearPendingSignup} from '@/lib/auth-pending';
import {callbackIntent} from '@/lib/auth-flow';
export async function GET(request:Request){
 const url=new URL(request.url),token=url.searchParams.get('token_hash'),type=url.searchParams.get('type'),business=callbackIntent(url);
 const redirect=(path:string)=>{const response=NextResponse.redirect(new URL(path,url.origin));response.headers.set('Cache-Control','private, no-store');return response;};
 try{
  if(!token||!['signup','recovery','email','email_change'].includes(type??''))throw new Error('Invalid confirmation');
  const client=await serverSupabase(),{error}=await client.auth.verifyOtp({token_hash:token,type:type as 'signup'|'recovery'|'email'|'email_change'});if(error)throw error;
  const destination=await authDestination(client,business);await clearPendingSignup();return redirect(type==='recovery'?'/reset-password':destination);
 }catch{return redirect(`/auth/error?reason=${type==='recovery'?'recovery':'confirmation'}&intent=${business?'business':'resident'}`);}
}
