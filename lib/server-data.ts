import "server-only";
import {businessCatalog,type BusinessCandidate} from "@/lib/business-catalog";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AppState, Business, Chat, LocalPost, ResidentUser, PostAuthor, SzocialNotification, LocationInfo } from "@/types";
import { createEmptyLocation } from "@/lib/location";
import { createInitialsAvatar } from "@/lib/user-photo";
// The API uses the user's cookie client, never service_role, for all ordinary reads.
// Flexible UI metadata remains JSON while identity/status/billing columns are authoritative.
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const keys:Record<string,string[]>={profile_private:['user_id'],account_roles:['user_id','role'],conversation_members:['conversation_id','user_id'],blocks:['blocker_id','blocked_id'],post_interests:['post_id','user_id'],post_saves:['post_id','user_id'],post_likes:['post_id','user_id'],business_saves:['business_id','user_id'],subscriptions:['business_id']};
export function mapMessage(m:Row,businessOwnerIds:string[]=[]){return {id:m.id,clientId:m.client_id,senderId:m.sender_id,senderType:businessOwnerIds.includes(m.sender_id)?'business' as const:'resident' as const,text:m.body,kind:m.kind,createdAt:m.created_at,...(m.kind==='location'?{latitude:m.data.latitude,longitude:m.data.longitude,mapsUrl:`https://www.google.com/maps/search/?api=1&query=${m.data.latitude},${m.data.longitude}`,locationLabel:'Shared location'}:{})};}
export async function messagePage(client:SupabaseClient,id:string,before?:{at:string;id:string}) {
 let query=client.from('messages').select('*').eq('conversation_id',id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(51);
 if(before)query=query.or(`created_at.lt.${before.at},and(created_at.eq.${before.at},id.lt.${before.id})`);
 const {data,error}=await query;if(error)throw error;
 return {messages:(data??[]).slice(0,50).reverse(),hasMore:(data??[]).length>50};
}
export async function signedMedia(client:SupabaseClient, paths:string[]) {
 const unique=[...new Set(paths.filter(Boolean))],urls=new Map<string,string>();if(!unique.length)return urls;
 const media:Row[]=[];for(let i=0;i<unique.length;i+=100){const {data,error}=await client.from('media').select('bucket,path').in('path',unique.slice(i,i+100));if(error)throw error;media.push(...data??[]);}
 await Promise.all(['szocial-avatars','szocial-business','szocial-posts'].map(async bucket=>{
  const visible=media.filter(m=>m.bucket===bucket).map(m=>m.path);for(let i=0;i<visible.length;i+=100){const {data,error}=await client.storage.from(bucket).createSignedUrls(visible.slice(i,i+100),3600);if(error)throw error;data?.forEach(entry=>{if(entry.path&&entry.signedUrl)urls.set(entry.path,entry.signedUrl);});}
 }));return urls;
}
const profileColumns='id,full_name,avatar_path,bio,area,city,verified,account_status,created_at';
export async function mapPosts(client:SupabaseClient, posts:Row[]):Promise<LocalPost[]> {
 if(!posts.length)return [];
 const ids=posts.map(p=>p.id);
 const [comments,interests,saves,likes]=await Promise.all(['comments','post_interests','post_saves','post_likes'].map(async table=>{const records:Row[]=[];for(let start=0;start<ids.length;start+=100){for(let offset=0;;offset+=500){let query=client.from(table).select('*').in('post_id',ids.slice(start,start+100));for(const key of keys[table]??['id'])query=query.order(key);const {data,error}=await query.range(offset,offset+499);if(error)throw error;records.push(...data??[]);if(!data||data.length<500)break;}}return records;}));
 const authorIds=[...new Set([...posts.map(p=>p.author_id),...comments.map(c=>c.author_id)])];
 const authors:Row[]=[];for(let i=0;i<authorIds.length;i+=100){const {data,error}=await client.from('profiles').select(profileColumns).in('id',authorIds.slice(i,i+100));if(error)throw error;authors.push(...data??[]);}
 const urls=await signedMedia(client,[...posts.flatMap(p=>p.data.images??[]),...(authors??[]).map(p=>p.avatar_path)]);
 const people:PostAuthor[]=(authors??[]).map(p=>({id:p.id,name:p.full_name,avatarPath:p.avatar_path,profilePhoto:urls.get(p.avatar_path),verified:p.verified}));
 return posts.map(p=>({...p.data,id:p.id,type:p.type,authorId:p.author_id,title:p.title,description:p.description,category:p.category,
  author:people.find(author=>author.id===p.author_id),people:people.filter(person=>person.id===p.author_id||comments.some(c=>c.post_id===p.id&&c.author_id===person.id)),imagePaths:p.data.images??[],images:(p.data.images??[]).map((path:string)=>urls.get(path)).filter(Boolean),
  location:{...p.location,latitude:p.latitude,longitude:p.longitude},visibility:p.visibility,status:p.status,createdAt:p.created_at,updatedAt:p.updated_at,
  contactPreference:p.data.contactPreference??'Chat only',reports:0,distanceKm:0,
  comments:comments.filter(c=>c.post_id===p.id).map(c=>({id:c.id,userId:c.author_id,text:c.body,createdAt:c.created_at})),
  interestedUserIds:interests.filter(i=>i.post_id===p.id).map(i=>i.user_id),acceptedUserIds:interests.filter(i=>i.post_id===p.id&&i.status==='accepted').map(i=>i.user_id),
  savedByUserIds:saves.filter(i=>i.post_id===p.id).map(i=>i.user_id),likedByUserIds:likes.filter(i=>i.post_id===p.id).map(i=>i.user_id)
 }));
}
export type AppDomain='core'|'notifications'|'chats'|'businesses'|'posts'|'joined'|'billing'|'people'|'reports';
export const appDomains:AppDomain[]=['core','notifications','chats','businesses','posts','joined','billing','people','reports'];
const columns:Record<string,string>={profiles:profileColumns,profile_private:'user_id,mobile,age,gender,location,privacy,onboarding_complete',account_roles:'user_id,role',businesses:'id,owner_id,name,category,data,status,verified,featured,created_at,updated_at',conversations:'id,post_id,business_id,created_at,updated_at',conversation_members:'conversation_id,user_id,read_at',blocks:'blocker_id,blocked_id,created_at',notifications:'id,recipient_id,sender_id,type,title,message,entity_id,entity_type,is_read,created_at',business_offers:'id,business_id,body,created_at',business_saves:'business_id,user_id',business_events:'business_id,kind',pricing_plans:'id,name,amount_paise,data',payments:'id,business_id,user_id,plan_id,mode,refunded_paise,amount_paise,status,razorpay_payment_id,created_at,verified_at',subscriptions:'business_id,payment_id,plan_id,active_until',reports:'id,item_type,item_id,item_label,reason,reporter_id,reported_user_id,status,created_at',posts:'id,author_id,type,category,title,description,location,latitude,longitude,visibility,status,data,created_at,updated_at'};
export async function appSnapshot(client:SupabaseClient,user:User,domain:AppDomain='core',offset=0,options:{own?:boolean;businessId?:string;allPosts?:boolean;directory?:boolean;preview?:boolean;query?:string;category?:string;location?:LocationInfo}={}){
 const names=Object.keys(columns),db:Record<string,Row[]>=Object.fromEntries(names.map(t=>[t,[]]));let hasMore=false,total:number|null=null;
 const pageSize=30;
 const read=async(table:string,filter?:(q:any)=>any,paged=false)=>{ // eslint-disable-line @typescript-eslint/no-explicit-any
  if(paged){let q=client.from(table).select(columns[table],{count:'exact'});if(filter)q=filter(q);q=q.order(table==='profiles'?'id':'created_at',{ascending:false});if(table!=='profiles')q=q.order('id',{ascending:false});const {data,error,count}=await q.range(offset,offset+pageSize);if(error)throw error;hasMore=(data??[]).length>pageSize;total=count??null;db[table]=(data??[]).slice(0,pageSize);}
  else{db[table]=[];for(let start=0;;start+=500){let page=client.from(table).select(columns[table]);if(filter)page=filter(page);for(const key of keys[table]??['id'])page=page.order(key);const {data,error}=await page.range(start,start+499);if(error)throw error;db[table].push(...data??[]);if(!data||data.length<500)break;}}
 };
 if(domain==='core')await Promise.all([read('profiles',q=>q.eq('id',user.id)),read('profile_private',q=>q.eq('user_id',user.id)),read('account_roles',q=>q.eq('user_id',user.id)),read('businesses',q=>q.eq('owner_id',user.id))]);
 if(domain==='people'){await read('profiles',undefined,true);if(options.allPosts&&db.profiles.length)for(let start=0;;start+=500){const {data,error}=await client.from('reports').select('reported_user_id').in('reported_user_id',db.profiles.map(p=>p.id)).order('id').range(start,start+499);if(error)throw error;db.reports.push(...data??[]);if(!data||data.length<500)break;}}
 if(domain==='notifications'){await Promise.all([read('notifications',q=>q.eq('recipient_id',user.id),true),read('account_roles',q=>q.eq('user_id',user.id))]);const ids=[...new Set(db.notifications.map(n=>n.sender_id).filter(Boolean))];if(ids.length)await read('profiles',q=>q.in('id',ids));}
 if(domain==='posts')await read('posts',options.allPosts?undefined:q=>q.eq('author_id',user.id),true);
 if(domain==='joined'){const {data,error,count}=await client.from('post_interests').select('post_id',{count:'exact'}).eq('user_id',user.id).order('created_at',{ascending:false}).order('post_id').range(offset,offset+pageSize);if(error)throw error;hasMore=(data??[]).length>pageSize;total=count??null;const ids=(data??[]).slice(0,pageSize).map(r=>r.post_id);if(ids.length)await read('posts',q=>q.in('id',ids));}
 if(domain==='billing')await Promise.all([read('payments',undefined,true),read('pricing_plans'),read('businesses',q=>q.eq('owner_id',user.id))]);
 if(domain==='reports')await read('reports',undefined,true);
 if(domain==='businesses'){
  if(options.directory&&!options.businessId&&!options.own){
   const candidates:BusinessCandidate[]=[];for(let start=0;;start+=500){const {data,error}=await client.from('businesses').select('id,name,category,created_at,location:data->location,about:data->>about').eq('status','Live').order('id').range(start,start+499);if(error)throw error;candidates.push(...(data??[]).map(row=>({...row,location:row.location&&typeof row.location==='object'&&!Array.isArray(row.location)?row.location as LocationInfo:undefined})));if(!data||data.length<500)break;}
   const ranked=businessCatalog(candidates,options.location??createEmptyLocation(),options.query,options.category),size=options.preview?3:pageSize;total=ranked.length;hasMore=!options.preview&&ranked.length>offset+size;const ids=ranked.slice(offset,offset+size).map(b=>b.id);if(ids.length){await read('businesses',q=>q.in('id',ids));db.businesses.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id));}
  }else await read('businesses',options.businessId?q=>q.eq('id',options.businessId):options.own?q=>q.eq('owner_id',user.id):undefined,true);
  const ids=db.businesses.map(b=>b.id);if(ids.length)await Promise.all([read('business_offers',q=>q.in('business_id',ids)),read('business_saves',q=>q.eq('user_id',user.id).in('business_id',ids))]);}
 if(domain==='chats'){
  const {data,error,count}=await client.from('conversations').select(columns.conversations+',conversation_members(user_id,read_at,profiles('+profileColumns+')),last_message:messages(id,conversation_id,sender_id,client_id,body,kind,data,created_at),businesses('+columns.businesses+')',{count:'exact'}).order('updated_at',{ascending:false}).order('id',{ascending:false}).order('created_at',{referencedTable:'last_message',ascending:false}).order('id',{referencedTable:'last_message',ascending:false}).limit(1,{referencedTable:'last_message'}).range(offset,offset+pageSize);
  if(error)throw error;hasMore=(data??[]).length>pageSize;total=count??null;db.conversations=(data??[]).slice(0,pageSize);db.conversation_members=db.conversations.flatMap(c=>(c.conversation_members??[]).map((m:Row)=>({...m,conversation_id:c.id})));db.profiles=db.conversation_members.map(m=>m.profiles).filter(Boolean);db.businesses=db.conversations.map(c=>c.businesses).filter(Boolean);
  const peers=db.conversation_members.filter(m=>m.user_id!==user.id).map(m=>m.user_id);
  if(peers.length)await read('blocks',q=>q.or(`and(blocker_id.eq.${user.id},blocked_id.in.(${peers.join(',')})),and(blocked_id.eq.${user.id},blocker_id.in.(${peers.join(',')}))`));
  const clauses=db.conversations.map(c=>{const readAt=db.conversation_members.find(m=>m.conversation_id===c.id&&m.user_id===user.id)?.read_at;return readAt?`and(conversation_id.eq.${c.id},created_at.gt.${readAt})`:`conversation_id.eq.${c.id}`;});
  db.unread=[];if(clauses.length)for(let start=0;;start+=500){const {data,error}=await client.from('messages').select('conversation_id').neq('sender_id',user.id).neq('kind','system').or(clauses.join(',')).order('id').range(start,start+499);if(error)throw error;db.unread.push(...data??[]);if(!data||data.length<500)break;}

 }
 if(db.businesses.length){const ids=db.businesses.map(b=>b.id);await read('subscriptions',q=>q.in('business_id',ids));const paymentIds=db.subscriptions.map(s=>s.payment_id);if(paymentIds.length&&domain!=='billing')await read('payments',q=>q.in('id',paymentIds));}
 let unreadCount:number|undefined;if(domain==='notifications'){const {count,error}=await client.from('notifications').select('id',{count:'exact',head:true}).eq('recipient_id',user.id).eq('is_read',false);if(error)throw error;unreadCount=count??0;}
 const businessCounts=new Map<string,{views:number;messages:number}>();
 if(domain==='businesses')await Promise.all(db.businesses.filter(b=>b.owner_id===user.id).map(async b=>{const [views,messages]=await Promise.all([client.from('business_events').select('id',{count:'exact',head:true}).eq('business_id',b.id).eq('kind','view'),client.from('conversations').select('id',{count:'exact',head:true}).eq('business_id',b.id)]);if(views.error)throw views.error;if(messages.error)throw messages.error;businessCounts.set(b.id,{views:views.count??0,messages:messages.count??0});}));
 const paths=[...db.profiles.map(p=>p.avatar_path),...db.businesses.flatMap(b=>[b.data.logo,b.data.coverImage,...b.data.gallery??[]])];
 const urls=await signedMedia(client,paths);
 const histories=db.conversations.map(c=>({messages:c.last_message??[],hasMore:false}));
 db.profiles=[...new Map(db.profiles.map(p=>[p.id,p])).values()];db.businesses=[...new Map(db.businesses.map(b=>[b.id,b])).values()];
 const residents:ResidentUser[]=db.profiles.map(p=>{
  const own=db.profile_private.find(x=>x.user_id===p.id);
  return {id:p.id,name:p.full_name,email:p.id===user.id?user.email??'':'',mobile:own?.mobile,
   avatarPath:p.avatar_path,avatar:urls.get(p.avatar_path)??createInitialsAvatar(p.full_name),profilePhoto:urls.get(p.avatar_path),bio:p.bio,
   age:own?.age,gender:own?.gender,location:own?.location??{area:p.area,city:p.city},verified:p.verified,status:p.account_status,
   joinedDate:p.created_at,reports:db.reports.filter(r=>r.reported_user_id===p.id).length,
   privacy:own?.privacy??{showAge:false,showExactArea:false,allowDirectMessages:true}};
 });
 const businesses:Business[]=db.businesses.map(b=>{
  const sub=db.subscriptions.find(s=>s.business_id===b.id),payment=db.payments.find(p=>p.id===sub?.payment_id&&p.status==='paid');
  const offers=db.business_offers.filter(o=>o.business_id===b.id);
  return {...b.data,id:b.id,ownerId:b.owner_id,name:b.name,category:b.category,status:b.status,verified:b.verified,featured:b.featured,createdAt:b.created_at,updatedAt:b.updated_at,
   detailsLoaded:domain==='businesses',analyticsLoaded:domain==='businesses'&&b.owner_id===user.id,isSaved:db.business_saves.some(s=>s.business_id===b.id&&s.user_id===user.id),location:b.data.location??createEmptyLocation(),address:b.data.address??'',phone:b.data.phone??'',hours:b.data.hours??'',about:b.data.about??'',services:b.data.services??[],tags:b.data.tags??[],priceRange:b.data.priceRange??'Mid-range',openStatus:b.data.openStatus??'Open',listedByResidents:false,
   mediaPaths:{logo:b.data.logo??'',coverImage:b.data.coverImage??'',gallery:b.data.gallery??[]},logo:urls.get(b.data.logo)??createInitialsAvatar(b.name),coverImage:urls.get(b.data.coverImage)??'',gallery:(b.data.gallery??[]).map((p:string)=>urls.get(p)).filter(Boolean),
   offers:offers.map(o=>o.body),offerCreatedAt:Object.fromEntries(offers.map(o=>[o.body,o.created_at])),
   views:businessCounts.get(b.id)?.views??0,saves:db.business_saves.filter(s=>s.business_id===b.id).length,messages:businessCounts.get(b.id)?.messages??db.conversations.filter(c=>c.business_id===b.id).length,rating:0,reviews:0,
   payment:payment?{planId:payment.plan_id,planName:db.pricing_plans.find(p=>p.id===payment.plan_id)?.name??payment.plan_id,amountPaid:payment.amount_paise/100,paymentId:payment.razorpay_payment_id,status:'paid',renewalDate:sub!.active_until,paidAt:payment.verified_at,mock:false}:undefined};
 });
 const ownBusiness=businesses.find(b=>b.ownerId===user.id);
 const isBusiness=db.account_roles.some(r=>r.user_id===user.id&&r.role==='business');
 const chats:Chat[]=db.conversations.map(c=>{
  const members=db.conversation_members.filter(m=>m.conversation_id===c.id),other=members.find(m=>m.user_id!==user.id);
  const blocks=db.blocks.filter(b=>members.some(m=>m.user_id===b.blocker_id)&&members.some(m=>m.user_id===b.blocked_id));
  const block=blocks.find(b=>b.blocker_id===user.id)??blocks[0];
  const history=histories[db.conversations.indexOf(c)];const messages=history.messages;
  return {id:c.id,type:c.business_id?'Business':'Fun',name:residents.find(r=>r.id===other?.user_id)?.name??'Neighbour',avatar:'',location:'',status:block?'Blocked':'Active',
   blockedByIds:blocks.map(b=>b.blocker_id),historyLoaded:false,historyHasMore:history.hasMore,blockedById:block?.blocker_id,blockedByType:block?.blocker_id===ownBusiness?.ownerId?'business':'resident',blockedAt:block?.created_at,
   participantIds:members.map(m=>m.user_id),participants:members.map(m=>({id:m.user_id,participantType:businesses.some(b=>b.ownerId===m.user_id)?'business':'resident',name:residents.find(r=>r.id===m.user_id)?.name??'Neighbour',profilePhoto:residents.find(r=>r.id===m.user_id)?.profilePhoto})),
   postId:c.post_id,businessId:c.business_id,createdAt:c.created_at,updatedAt:c.updated_at,lastMessageAt:messages.at(-1)?.created_at??c.created_at,
   readAtByParticipant:Object.fromEntries(members.filter(m=>m.read_at).map(m=>[m.user_id,m.read_at])),unread:(db.unread??[]).filter(m=>m.conversation_id===c.id).length,
   messages:messages.map((m:Row)=>mapMessage(m,db.businesses.map(b=>b.owner_id)))};
 });
 const postRows=db.posts;
 const notifications:SzocialNotification[]=db.notifications.map(n=>({id:n.id,recipientId:n.recipient_id,recipientType:isBusiness?'business':'resident',senderId:n.sender_id??'',senderName:residents.find(r=>r.id===n.sender_id)?.name??'Szocial',type:n.type,title:n.title,message:n.message,entityId:n.entity_id,entityType:n.entity_type,isRead:n.is_read,createdAt:n.created_at,chatId:n.entity_type==='chat'?n.entity_id:undefined,postId:n.entity_type==='post'?n.entity_id:undefined}));
 const state:AppState={residents,posts:await mapPosts(client,postRows??[]),businesses,businessOwners:ownBusiness?[{id:user.id,ownerName:residents.find(r=>r.id===user.id)?.name??'',email:user.email??'',businessId:ownBusiness.id,paymentStatus:ownBusiness.payment&&new Date(ownBusiness.payment.renewalDate)>new Date()?'paid':'unpaid'}]:[],
  chats,reports:db.reports.map(r=>({id:r.id,itemType:r.item_type,itemId:r.item_id,itemLabel:r.item_label,reason:r.reason,reportedBy:r.reporter_id,reportedUserIds:r.reported_user_id?[r.reported_user_id]:[],status:r.status,createdAt:r.created_at})),notifications:notifications.map(n=>({id:n.id,title:n.title,description:n.message,type:'Chat update' as const})),
  paymentPlans:db.pricing_plans.map(p=>({...p.data,id:p.id,name:p.name,price:p.amount_paise/100,amountPaise:p.amount_paise,features:p.data.features??[],description:p.data.description??''})),
  paymentHistory:db.payments.map(p=>({id:p.id,date:p.created_at,businessId:p.business_id,planName:db.pricing_plans.find(plan=>plan.id===p.plan_id)?.name??p.plan_id,mode:p.mode,refundedAmount:p.refunded_paise/100,amount:p.amount_paise/100,status:p.status,paymentId:p.razorpay_payment_id??p.id})),currentUserId:isBusiness?null:user.id,currentBusinessOwnerId:isBusiness?user.id:null,location:db.profile_private.find(p=>p.user_id===user.id)?.location??createEmptyLocation()};
 const fields:Record<AppDomain,(keyof AppState)[]>={core:['residents','businesses','businessOwners','currentUserId','currentBusinessOwnerId','location'],notifications:['residents'],chats:['chats','residents','businesses'],businesses:['businesses'],posts:['posts'],joined:['posts'],billing:['paymentPlans','paymentHistory','businesses'],people:['residents'],reports:['reports']};
 const patch=Object.fromEntries(fields[domain].map(key=>[key,state[key]]));
 return {actorId:user.id,domain,state:patch,...(domain==='notifications'?{notifications,unreadCount}:{}),...(domain==='core'?{roles:db.account_roles.map(r=>r.role),onboardingComplete:db.profile_private[0]?.onboarding_complete??false}:{}),page:{hasMore,nextOffset:offset+pageSize,total}};
}

export async function publicPeople(client:SupabaseClient,ids:string[]){const {data,error}=await client.from("profiles").select(profileColumns).in("id",ids);if(error)throw error;const urls=await signedMedia(client,(data??[]).map(p=>p.avatar_path));return (data??[]).map(p=>({id:p.id,name:p.full_name,profilePhoto:urls.get(p.avatar_path),verified:p.verified,location:{area:p.area,city:p.city}}));}
