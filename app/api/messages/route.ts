import { NextResponse } from 'next/server';
import { authenticatedClient } from '@/lib/supabase/server';
import { messagePage,mapMessage } from '@/lib/server-data';
export async function GET(request:Request){
 try{
  const {client}=await authenticatedClient(),q=new URL(request.url).searchParams,id=q.get('id')??'',at=q.get('before'),beforeId=q.get('beforeId');
  if(!/^[a-f0-9-]{36}$/i.test(id)||at&&(!beforeId||!/^[a-f0-9-]{36}$/i.test(beforeId)||!/^\d{4}-\d\d-\d\dT[\d:.]+(?:Z|[+]00:00)$/.test(at)))throw new Error('Invalid history cursor');
  const result=await messagePage(client,id,at&&beforeId?{at,id:beforeId}:undefined);
  return NextResponse.json({messages:result.messages.map(m=>mapMessage(m)),hasMore:result.hasMore},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({error:'Could not load conversation history'},{status:400});}
}
