import { authenticatedClient } from "@/lib/supabase/server";
import { mapPosts } from "@/lib/server-data";
import {RequestMetrics} from "@/lib/request-metrics";
export const dynamic='force-dynamic';
export async function GET(request:Request) {
 const metrics=new RequestMetrics();
 try {
  const {client,user}=await authenticatedClient(metrics),q=new URL(request.url).searchParams;
  const coordinate=(key:string,limit:number)=>{const value=q.get(key);if(!value)return null;const n=Number(value);return Number.isFinite(n)&&Math.abs(n)<=limit?n:null;};
  const categories:Record<string,string[]>={Sports:['Cricket','Football','Badminton','Gym'],Movies:['Movie'],Adventure:['Hiking'],Study:['Study','Tutor'],Food:['Cafe','Food','Restaurant']};
  const {data,error}=await client.rpc('discover_posts',{search_query:(q.get('q')??'').slice(0,200),sort_mode:['nearby','newest','oldest','farthest'].includes(q.get('sort')??'')?q.get('sort'):'nearby',
   viewer_lat:coordinate('lat',90),viewer_lng:coordinate('lng',180),viewer_area:q.get('area')??'',viewer_city:q.get('city')??'',categories:categories[q.get('category')??'']??null,
   post_type:q.get('type')==='help'||q.get('category')==='Help'?'help':q.get('type')==='fun'?'fun':null,post_status:q.get('status')==='Solved'?'Solved':'Active',urgency:q.get("category")==="Urgent"?"Urgent":null,page_size:21,page_offset:Math.max(0,Number(q.get('offset'))||0)});
  if(error)throw error;
  const mapped=await mapPosts(client,(data??[]).slice(0,20)),people=[...new Map(mapped.flatMap(p=>p.people??[]).map(p=>[p.id,p])).values()];
  return metrics.json({actorId:user.id,posts:mapped.map(({author,people,...post})=>{void author;void people;return post;}),people,hasMore:(data??[]).length>20});
 }catch(error){return metrics.json({error:error instanceof Error?error.message:'Unable to load feed'},(error as {status?:number}).status??503);}
}
