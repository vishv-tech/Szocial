import { NextResponse } from 'next/server';
import { authenticatedClient } from '@/lib/supabase/server';
import { messagePage,mapMessage } from '@/lib/server-data';
export async function GET(request:Request){
 try{
  const {client,user}=await authenticatedClient(),q=new URL(request.url).searchParams,id=q.get('id')??'',at=q.get('before'),beforeId=q.get('beforeId');
  if(!/^[a-f0-9-]{36}$/i.test(id)||at&&(!beforeId||!/^[a-f0-9-]{36}$/i.test(beforeId)||!/^\d{4}-\d\d-\d\dT[\d:.]+(?:Z|[+]00:00)$/.test(at)))throw new Error('Invalid history cursor');
  const {data:member,error:memberError}=await client.from('conversation_members').select('user_id,read_at').eq('conversation_id',id).eq('user_id',user.id).single();
  if(memberError&&memberError.code!=='PGRST116')throw memberError;
  if(!member)return NextResponse.json({error:'Conversation unavailable'},{status:403});
  let unread=client.from('messages').select('id',{count:'exact',head:true}).eq('conversation_id',id).neq('sender_id',user.id).neq('kind','system');if(member.read_at)unread=unread.gt('created_at',member.read_at);
  const {count:unreadCount,error:unreadError}=await unread;if(unreadError)throw unreadError;
  const result=await messagePage(client,id,at&&beforeId?{at,id:beforeId}:undefined);
  return NextResponse.json({messages:result.messages.map(m=>mapMessage(m)),hasMore:result.hasMore,unreadCount:unreadCount??0,readAt:member.read_at},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return NextResponse.json({error:'Could not load conversation history'},{status:(error as {status?:number}).status??503,headers:{'Cache-Control':'private, no-store'}});}
}
