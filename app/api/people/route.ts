import {NextResponse} from 'next/server';
import {authenticatedClient} from '@/lib/supabase/server';
import {publicPeople} from '@/lib/server-data';
export async function GET(request:Request){
 try{const {client}=await authenticatedClient(),ids=[...new Set((new URL(request.url).searchParams.get('ids')??'').split(',').filter(Boolean))];
 if(!ids.length||ids.length>100||ids.some(id=>!/^[a-f0-9-]{36}$/i.test(id)))return NextResponse.json({error:'Invalid people request'},{status:400});
 return NextResponse.json({people:await publicPeople(client,ids)},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return NextResponse.json({error:'Could not load people'},{status:(error as {status?:number}).status??503,headers:{'Cache-Control':'private, no-store'}});}
}
