import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {AdminStatistics} from '@/types';
import {AccessError} from '@/lib/supabase/server';
/** Only the admin dashboard needs platform-wide aggregates. Never sent to residents. */
export async function adminStatistics(client:SupabaseClient,userId:string):Promise<AdminStatistics>{
 const {data:role,error}=await client.from('account_roles').select('role').eq('user_id',userId).eq('role','admin').maybeSingle();
 if(error)throw new AccessError('Permission verification unavailable',503);if(!role)throw new AccessError('Administrator required',403);
 const count=async(table:string,column?:string,value?:string|string[])=>{let query=client.from(table).select('id',{count:'exact',head:true});if(column)query=Array.isArray(value)?query.in(column,value):query.eq(column,value!);const {count,error}=await query;if(error)throw error;return count??0;};
 // Fetch only aggregate inputs in bounded chunks; no profiles, chat histories or media.
 // A database aggregate RPC can replace these scans after a separately reviewed migration.
 const each=async(table:string,columns:string,visit:(row:Record<string,any>)=>void)=>{ // eslint-disable-line @typescript-eslint/no-explicit-any
  for(let offset=0;;offset+=500){const {data,error}=await client.from(table).select(columns).order('id').range(offset,offset+499);if(error)throw error;for(const row of data??[])visit(row);if(!data||data.length<500)break;}
 };
 const [residents,businesses,posts,activeResidents,liveBusinesses,activePosts,openReports,pendingApprovals]=await Promise.all([count('profiles'),count('businesses'),count('posts'),count('profiles','account_status','Active'),count('businesses','status','Live'),count('posts','status','Active'),count('reports','status','Open'),count('businesses','status',['Draft','Pending Approval'])]);
 const reportedPosts=new Set<string>(),reportedUsers=new Set<string>(),locations=new Map<string,number>();let revenuePaise=0;
 const [paid,recent,pending]=await Promise.all([
  client.from('subscriptions').select('business_id',{count:'exact',head:true}).gt('active_until',new Date().toISOString()),
  client.from('reports').select('id,item_type,item_label,reason,created_at').eq('status','Open').order('created_at',{ascending:false}).order('id').limit(5),
  client.from('businesses').select('id,name,category,data,status').in('status',['Draft','Pending Approval']).order('created_at',{ascending:false}).order('id').limit(5),
  each('reports','id,item_type,item_id,reported_user_id',row=>{if(row.item_type==='Post')reportedPosts.add(row.item_id);if(row.reported_user_id)reportedUsers.add(row.reported_user_id);}),
  each('payments','id,status,amount_paise,refunded_paise',row=>{if(row.status==='paid')revenuePaise+=Math.max(0,row.amount_paise-row.refunded_paise);}),
  each('posts','id,location',row=>{const label=[row.location?.area,row.location?.city].filter(Boolean).join(', ')||'Location unavailable';locations.set(label,(locations.get(label)??0)+1);})
 ]);
 for(const result of [paid,recent,pending])if(result.error)throw result.error;
 return {residents,businesses,posts,activeResidents,liveBusinesses,activePosts,openReports,pendingApprovals,reportedPosts:reportedPosts.size,reportedUsers:reportedUsers.size,revenue:revenuePaise/100,paidListings:paid.count??0,locationActivity:[...locations].sort((a,b)=>b[1]-a[1]).slice(0,5),recentReports:(recent.data??[]).map(r=>({id:r.id,itemType:r.item_type,itemLabel:r.item_label,reason:r.reason,createdAt:r.created_at})),pendingBusinesses:(pending.data??[]).map(b=>({id:b.id,name:b.name,category:b.category,status:b.status,location:b.data.location??{}}))};
}
