import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase/server';
import { getAdminSession } from '@/lib/admin-auth';
import { sameOrigin } from '@/lib/auth-security';
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid origin'},{status:403});
 try{const {email,password}=await request.json(),client=await serverSupabase();const {error}=await client.auth.signInWithPassword({email,password});
 if(error||!await getAdminSession()){await client.auth.signOut();return NextResponse.json({error:'Administrator access denied'},{status:403});}
 return NextResponse.json({success:true},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Sign-in unavailable'},{status:400});}
}
