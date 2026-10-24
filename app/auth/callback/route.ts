import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth-security";
export async function GET(request: Request) {
  const url=new URL(request.url);
  try {
    const client=await serverSupabase();
    const code=url.searchParams.get('code');
    if (!code) throw new Error('Missing authorization code');
    const {error}=await client.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return NextResponse.redirect(new URL(safeNext(url.searchParams.get('next'),'/onboarding'),url.origin));
  } catch { return NextResponse.redirect(new URL('/login?error=Authentication+callback+failed',url.origin)); }
}
