import {NextResponse} from 'next/server';
import {serverSupabase} from '@/lib/supabase/server';
import {authDestination} from '@/lib/auth-destination';
import {clearPendingSignup} from '@/lib/auth-pending';
import {callbackIntent} from '@/lib/auth-flow';
export async function GET(request:Request){
 const url=new URL(request.url),business=callbackIntent(url),recovery=url.searchParams.get('next')==='/reset-password';
 const redirect=(path:string)=>{const response=NextResponse.redirect(new URL(path,url.origin));response.headers.set('Cache-Control','private, no-store');return response;};
 try{
  const code=url.searchParams.get('code');if(!code||url.searchParams.has('error'))throw new Error('Authorization failed');
  const client=await serverSupabase(),{error}=await client.auth.exchangeCodeForSession(code);if(error)throw error;
  const destination=await authDestination(client,business);await clearPendingSignup();
  return redirect(recovery?'/reset-password':destination);
 }catch{return redirect(`/auth/error?reason=${recovery?'recovery':url.searchParams.get('error')==='access_denied'?'cancelled':'callback'}&intent=${business?'business':'resident'}`);}
}
