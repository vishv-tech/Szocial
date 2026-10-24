import { boundedJson } from '@/lib/request-body';
import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { passwordError, sameOrigin } from "@/lib/auth-security";
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}) {
  if (!sameOrigin(request)) return NextResponse.json({error:'Invalid origin'},{status:403});
  try {
    const {action}=await params, client=await serverSupabase();
    const body=await boundedJson(request);
    const origin=new URL(request.url).origin;
    const email=typeof body.email==='string'?body.email.trim():'';
    let error;
    if (action==='signup') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof body.password!=='string' || passwordError(body.password)) throw new Error('Enter a valid email and a password of at least 12 characters.');
      ({error}=await client.auth.signUp({email,password:body.password,options:{emailRedirectTo:`${origin}/auth/callback?next=/onboarding`,data:{full_name:String(body.name??'').slice(0,100)}}}));
    } else if (action==='login') {
      ({error}=await client.auth.signInWithPassword({email,password:String(body.password??'')}));
    } else if (action==='logout') { ({error}=await client.auth.signOut()); }
    else if (action==='forgot') {
      ({error}=await client.auth.resetPasswordForEmail(email,{redirectTo:`${origin}/auth/callback?next=/reset-password`}));
      // Avoid account enumeration; do not echo whether the address exists.
      if (error) console.error('Password reset request failed:',error.code);
      return NextResponse.json({success:true});
    } else if (action==='reset') {
      const {data:{user}}=await client.auth.getUser();
      if (!user || typeof body.password!=='string' || passwordError(body.password)) throw new Error('Sign in from your reset link and use at least 12 characters.');
      ({error}=await client.auth.updateUser({password:body.password}));
    } else return NextResponse.json({error:'Not found'},{status:404});
    if (error) throw new Error(action==='login'?'Invalid credentials or unverified email.':error.message);
    return NextResponse.json({success:true,requiresEmailConfirmation:action==='signup'},{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) {return NextResponse.json({error:error instanceof Error?error.message:'Authentication failed'},{status:400});}
}
