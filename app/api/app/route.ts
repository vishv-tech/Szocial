import {adminStatistics} from "@/lib/admin-stats";
import { boundedJson } from '@/lib/request-body';
import { NextResponse } from "next/server";
import { authenticatedClient } from "@/lib/supabase/server";
import {RequestMetrics} from "@/lib/request-metrics";
import { appSnapshot,appDomains,mapMessage,type AppDomain } from "@/lib/server-data";
import { sameOrigin } from "@/lib/auth-security";
export const dynamic='force-dynamic';
export async function GET(request:Request) {
 const metrics=new RequestMetrics();
 try{const {client,user}=await authenticatedClient(metrics),q=new URL(request.url).searchParams,domain=q.get('domain')??'core';
  if(domain==='stats')return metrics.json({actorId:user.id,domain,state:{},stats:await adminStatistics(client,user.id)});
  if(!appDomains.includes(domain as AppDomain))return metrics.json({error:'Unknown resource'},400);
  return metrics.json(await appSnapshot(client,user,domain as AppDomain,Math.max(0,Number(q.get('offset'))||0),{own:q.get('own')==='1',businessId:q.get('id')??undefined,allPosts:q.get('scope')==='all',directory:q.get('scope')!=='all',preview:q.get('preview')==='1',query:(q.get('q')??'').slice(0,200),category:q.get('category')??'All',location:{area:q.get('area')??'',city:q.get('city')??'',latitude:q.has('lat')?Number(q.get('lat')):undefined,longitude:q.has('lng')?Number(q.get('lng')):undefined}}));
 }catch(error){return metrics.json({error:error instanceof Error?error.message:'Unable to load resource'},(error as {status?:number}).status??503);}
}
export async function POST(request:Request) {
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid origin'},{status:403});
 try {
  const {client,user}=await authenticatedClient();
  if(Number(request.headers.get('content-length')??0)>100000)throw new Error('Request too large');
  const {action,args}=await boundedJson(request);
  if(typeof action!=='string'||!args||typeof args!=='object'||Array.isArray(args))throw new Error('Invalid action');
  const {data,error}=await client.rpc('app_mutate',{action,args});if(error)throw error;
  if(action==='message'){
   const {data:message,error:messageError}=await client.from('messages').select('id,conversation_id,sender_id,client_id,body,kind,data,created_at').eq('id',data.id).single();if(messageError||!message)throw new Error('Message confirmation is pending; retry with the same client ID.');
   return NextResponse.json({...data,message:mapMessage(message)},{headers:{'Cache-Control':'private, no-store'}});
  }
  if(action==='read_chat'){const {data:member}=await client.from('conversation_members').select('read_at').eq('conversation_id',args.id).eq('user_id',user.id).single();return NextResponse.json({...data,readAt:member?.read_at},{headers:{'Cache-Control':'private, no-store'}});}
  return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
 } catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Operation failed'},{status:(error as {status?:number}).status??400});}
}
