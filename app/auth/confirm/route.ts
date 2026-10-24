import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth-security";
export async function GET(request:Request) {
  const url=new URL(request.url), token=url.searchParams.get('token_hash'), type=url.searchParams.get('type');
  try {
    if (!token || !['signup','recovery','email','email_change'].includes(type ?? '')) throw new Error('Invalid confirmation');
    const client=await serverSupabase();
    const {error}=await client.auth.verifyOtp({token_hash:token,type:type as 'signup'|'recovery'|'email'|'email_change'});
    if (error) throw error;
    return NextResponse.redirect(new URL(type==='recovery'?'/reset-password':safeNext(url.searchParams.get('next'),'/onboarding'),url.origin));
  } catch { return NextResponse.redirect(new URL('/login?error=Confirmation+link+expired+or+invalid',url.origin)); }
}
