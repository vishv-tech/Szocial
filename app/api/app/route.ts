import { NextResponse } from "next/server";
import { authenticatedClient } from "@/lib/supabase/server";
import { appSnapshot } from "@/lib/server-data";
import { sameOrigin } from "@/lib/auth-security";
export const dynamic='force-dynamic';
export async function GET() {
 try {const {client,user}=await authenticatedClient();return NextResponse.json(await appSnapshot(client,user),{headers:{'Cache-Control':'private, no-store'}});}
 catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Unable to load application'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
export async function POST(request:Request) {
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid origin'},{status:403});
 try {
  const {client}=await authenticatedClient();
  if(Number(request.headers.get('content-length')??0)>100000)throw new Error('Request too large');
  const {action,args}=await request.json();
  if(typeof action!=='string'||!args||typeof args!=='object'||Array.isArray(args))throw new Error('Invalid action');
  const {data,error}=await client.rpc('app_mutate',{action,args});if(error)throw error;
  return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
 } catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Operation failed'},{status:400});}
}
