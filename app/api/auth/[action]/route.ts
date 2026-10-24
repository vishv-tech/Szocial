import {boundedJson} from '@/lib/request-body';
import {NextResponse} from 'next/server';
import {serverSupabase} from '@/lib/supabase/server';
import {passwordError,sameOrigin} from '@/lib/auth-security';
import {authDestination} from '@/lib/auth-destination';
import {EMAIL_COOLDOWN_SECONDS,onboardingPath,retrySeconds} from '@/lib/auth-flow';
import {pendingSignup,savePendingSignup,clearPendingSignup,claimEmailAttempt} from '@/lib/auth-pending';
const headers={'Cache-Control':'private, no-store'};
function failure(error:unknown,retryAfter=EMAIL_COOLDOWN_SECONDS){
 const e=error as {status?:number;code?:string;name?:string;message?:string};
 if(e.status===429||e.code?.includes('rate_limit'))return NextResponse.json({outcome:'rate_limited',error:'Too many email requests. Please wait before trying again.',retryAfter},{status:429,headers:{...headers,'Retry-After':String(retryAfter)}});
 if(!e.status||e.status>=500||e.name==='AuthRetryableFetchError')return NextResponse.json({outcome:'uncertain',error:'We could not confirm the result. Check your inbox or try signing in before requesting another email.',retryAfter},{status:503,headers:{...headers,'Retry-After':String(retryAfter)}});
 return NextResponse.json({outcome:'rejected',error:e.message??'Authentication failed'},{status:400,headers});
}
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}){
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid origin'},{status:403,headers});
 let retryAfter=EMAIL_COOLDOWN_SECONDS;
 try{
  const {action}=await params,body=await boundedJson(request),origin=new URL(request.url).origin;
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'',business=body.business===true;
  const client=await serverSupabase({onAuthResponse:response=>{if(response.status===429)retryAfter=retrySeconds(response.headers.get('retry-after'));}});
  if(action==='signup'||action==='resend'){
   const pending=await pendingSignup();
   if(action==='signup'&&pending?.accepted&&pending.email===email)return NextResponse.json({outcome:'confirmation_required',next:'/check-email',retryAfter:Math.max(0,Math.ceil((pending.retryAt-Date.now())/1000))},{headers});
   if(action==='resend'&&!pending?.accepted)return NextResponse.json({outcome:'rejected',error:'Start signup or use account recovery before resending.'},{status:400,headers});
   const recipient=action==='resend'?pending!.email:email,intent=action==='resend'?pending!.business:business;
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)||recipient.length>254||action==='signup'&&(typeof body.password!=='string'||passwordError(body.password)))return NextResponse.json({outcome:'rejected',error:'Enter a valid email and a password between 12 and 128 characters.'},{status:400,headers});
   const cooldown=Math.max(pending?.email===recipient?Math.ceil((pending!.retryAt-Date.now())/1000):0,claimEmailAttempt(recipient));
   if(cooldown>0)return failure({status:429},cooldown);
   await savePendingSignup({email:recipient,business:intent,accepted:action==='resend',retryAt:Date.now()+retryAfter*1000},request);
   const emailRedirectTo=`${origin}/auth/callback?next=${encodeURIComponent(onboardingPath(intent))}`;
   if(action==='resend'){
    const {error}=await client.auth.resend({type:'signup',email:recipient,options:{emailRedirectTo}});
    await savePendingSignup({...pending!,retryAt:Date.now()+retryAfter*1000},request);
    if(error)return failure(error,retryAfter);
    return NextResponse.json({outcome:'confirmation_required',retryAfter,message:'Resend request accepted. Check your inbox and spam folder.'},{headers});
   }
   const {data,error}=await client.auth.signUp({email:recipient,password:body.password,options:{emailRedirectTo,data:{full_name:String(body.name??'').slice(0,100)}}});
   if(error){await savePendingSignup({email:recipient,business:intent,accepted:false,retryAt:Date.now()+retryAfter*1000},request);return failure(error,retryAfter);}
   if(!data?.user&&!data?.session)return failure({status:503},retryAfter);
   if(data.session){const {data:{user},error}=await client.auth.getUser();if(error||!user)return failure({status:503},retryAfter);
    await clearPendingSignup();return NextResponse.json({outcome:'authenticated',next:onboardingPath(intent)},{headers});}
   await savePendingSignup({email:recipient,business:intent,accepted:true,retryAt:Date.now()+retryAfter*1000},request);
   return NextResponse.json({outcome:'confirmation_required',next:'/check-email',retryAfter},{headers});
  }
  let error;
  if(action==='login')({error}=await client.auth.signInWithPassword({email,password:String(body.password??'')}));
  else if(action==='logout')({error}=await client.auth.signOut());
  else if(action==='forgot'){
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return NextResponse.json({error:'Enter a valid email.'},{status:400,headers});
   const cooldown=claimEmailAttempt(email);if(cooldown)return failure({status:429},cooldown);
   ({error}=await client.auth.resetPasswordForEmail(email,{redirectTo:`${origin}/auth/callback?next=/reset-password`}));
   if(error&&error.status!==400)return failure(error,retryAfter);
   return NextResponse.json({success:true},{headers});
  }else if(action==='reset'){
   const {data:{user}}=await client.auth.getUser();
   if(!user||typeof body.password!=='string'||passwordError(body.password))return NextResponse.json({error:'Open your reset link and use a password between 12 and 128 characters.'},{status:400,headers});
   ({error}=await client.auth.updateUser({password:body.password}));
  }else return NextResponse.json({error:'Not found'},{status:404,headers});
  if(error)return failure(action==='login'&&error.status!==429?{status:error.status??400,message:'Invalid credentials or unverified email.'}:error,retryAfter);
  if(action==='login'){const next=await authDestination(client,business);await clearPendingSignup();return NextResponse.json({success:true,next},{headers});}
  return NextResponse.json({success:true},{headers});
 }catch(error){return failure(error,retryAfter);}
}
