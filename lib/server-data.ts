import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AppState, Business, Chat, LocalPost, ResidentUser, SzocialNotification } from "@/types";
import { createEmptyLocation } from "@/lib/location";
import { createInitialsAvatar } from "@/lib/user-photo";
// The API uses the user's cookie client, never service_role, for all ordinary reads.
// Flexible UI metadata remains JSON while identity/status/billing columns are authoritative.
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const keys:Record<string,string[]>={profile_private:['user_id'],account_roles:['user_id','role'],conversation_members:['conversation_id','user_id'],blocks:['blocker_id','blocked_id'],post_interests:['post_id','user_id'],post_saves:['post_id','user_id'],post_likes:['post_id','user_id'],business_saves:['business_id','user_id'],subscriptions:['business_id']};
export async function rows(client:SupabaseClient, table:string):Promise<Row[]> {
 const result:Row[]=[];
 for(let offset=0;;offset+=500){
  let query=client.from(table).select('*');
  for(const key of keys[table]??['id'])query=query.order(key);
  const {data,error}=await query.range(offset,offset+499);
  if(error)throw new Error(`${table}: ${error.message}`);
  result.push(...data??[]);if(!data||data.length<500)return result;
 }
}
export function mapMessage(m:Row,businessOwnerIds:string[]=[]){return {id:m.id,senderId:m.sender_id,senderType:businessOwnerIds.includes(m.sender_id)?'business' as const:'resident' as const,text:m.body,kind:m.kind,createdAt:m.created_at,...(m.kind==='location'?{latitude:m.data.latitude,longitude:m.data.longitude,mapsUrl:`https://www.google.com/maps/search/?api=1&query=${m.data.latitude},${m.data.longitude}`,locationLabel:'Shared location'}:{})};}
export async function messagePage(client:SupabaseClient,id:string,before?:{at:string;id:string}) {
 let query=client.from('messages').select('*').eq('conversation_id',id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(51);
 if(before)query=query.or(`created_at.lt.${before.at},and(created_at.eq.${before.at},id.lt.${before.id})`);
 const {data,error}=await query;if(error)throw error;
 return {messages:(data??[]).slice(0,50).reverse(),hasMore:(data??[]).length>50};
}
export async function signedMedia(client:SupabaseClient) {
 const media=await rows(client,'media');const urls=new Map<string,string>();
 for(const bucket of ['szocial-avatars','szocial-business','szocial-posts']) {
  const paths=media.filter(m=>m.bucket===bucket).map(m=>m.path);
  if(!paths.length)continue;
  const {data,error}=await client.storage.from(bucket).createSignedUrls(paths,3600);
  if(error)throw error;
  data?.forEach(entry=>{if(entry.path&&entry.signedUrl)urls.set(entry.path,entry.signedUrl);});
 }
 return urls;
}
export async function mapPosts(client:SupabaseClient, posts:Row[]):Promise<LocalPost[]> {
 if(!posts.length)return [];
 const ids=posts.map(p=>p.id);
 const urls=await signedMedia(client);
 const [comments,interests,saves,likes]=await Promise.all(['comments','post_interests','post_saves','post_likes'].map(async table=>{const records:Row[]=[];for(let start=0;start<ids.length;start+=100){for(let offset=0;;offset+=500){let query=client.from(table).select('*').in('post_id',ids.slice(start,start+100));for(const key of keys[table]??['id'])query=query.order(key);const {data,error}=await query.range(offset,offset+499);if(error)throw error;records.push(...data??[]);if(!data||data.length<500)break;}}return records;}));
 return posts.map(p=>({...p.data,id:p.id,type:p.type,authorId:p.author_id,title:p.title,description:p.description,category:p.category,
  imagePaths:p.data.images??[],images:(p.data.images??[]).map((path:string)=>urls.get(path)).filter(Boolean),
  location:{...p.location,latitude:p.latitude,longitude:p.longitude},visibility:p.visibility,status:p.status,createdAt:p.created_at,updatedAt:p.updated_at,
  contactPreference:p.data.contactPreference??'Chat only',reports:0,distanceKm:0,
  comments:comments.filter(c=>c.post_id===p.id).map(c=>({id:c.id,userId:c.author_id,text:c.body,createdAt:c.created_at})),
  interestedUserIds:interests.filter(i=>i.post_id===p.id).map(i=>i.user_id),acceptedUserIds:interests.filter(i=>i.post_id===p.id&&i.status==='accepted').map(i=>i.user_id),
  savedByUserIds:saves.filter(i=>i.post_id===p.id).map(i=>i.user_id),likedByUserIds:likes.filter(i=>i.post_id===p.id).map(i=>i.user_id)
 }));
}
export async function appSnapshot(client:SupabaseClient,user:User) {
 const tables=['profiles','profile_private','account_roles','businesses','conversations','conversation_members','blocks','reports','notifications','business_offers','business_saves','business_events','pricing_plans','payments','subscriptions'];
 const result=await Promise.all(tables.map(t=>rows(client,t)));
 const db=Object.fromEntries(tables.map((t,i)=>[t,result[i]]));
 const urls=await signedMedia(client);
 const histories=await Promise.all(db.conversations.map(c=>messagePage(client,c.id)));
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
   location:b.data.location??createEmptyLocation(),address:b.data.address??'',phone:b.data.phone??'',hours:b.data.hours??'',about:b.data.about??'',services:b.data.services??[],tags:b.data.tags??[],priceRange:b.data.priceRange??'Mid-range',openStatus:b.data.openStatus??'Open',listedByResidents:false,
   mediaPaths:{logo:b.data.logo??'',coverImage:b.data.coverImage??'',gallery:b.data.gallery??[]},logo:urls.get(b.data.logo)??createInitialsAvatar(b.name),coverImage:urls.get(b.data.coverImage)??'',gallery:(b.data.gallery??[]).map((p:string)=>urls.get(p)).filter(Boolean),
   offers:offers.map(o=>o.body),offerCreatedAt:Object.fromEntries(offers.map(o=>[o.body,o.created_at])),
   views:db.business_events.filter(e=>e.business_id===b.id&&e.kind==='view').length,saves:db.business_saves.filter(s=>s.business_id===b.id).length,messages:db.conversations.filter(c=>c.business_id===b.id).length,rating:0,reviews:0,
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
   blockedByIds:blocks.map(b=>b.blocker_id),historyHasMore:history.hasMore,blockedById:block?.blocker_id,blockedByType:block?.blocker_id===ownBusiness?.ownerId?'business':'resident',blockedAt:block?.created_at,
   participantIds:members.map(m=>m.user_id),participants:members.map(m=>({id:m.user_id,participantType:businesses.some(b=>b.ownerId===m.user_id)?'business':'resident',name:residents.find(r=>r.id===m.user_id)?.name??'Neighbour',profilePhoto:residents.find(r=>r.id===m.user_id)?.profilePhoto})),
   postId:c.post_id,businessId:c.business_id,createdAt:c.created_at,updatedAt:c.updated_at,lastMessageAt:messages.at(-1)?.created_at??c.created_at,
   readAtByParticipant:Object.fromEntries(members.filter(m=>m.read_at).map(m=>[m.user_id,m.read_at])),unread:0,
   messages:messages.map(m=>mapMessage(m,db.businesses.map(b=>b.owner_id)))};
 });
 const postRows=await rows(client,'posts');
 const notifications:SzocialNotification[]=db.notifications.map(n=>({id:n.id,recipientId:n.recipient_id,recipientType:isBusiness?'business':'resident',senderId:n.sender_id??'',senderName:residents.find(r=>r.id===n.sender_id)?.name??'Szocial',type:n.type,title:n.title,message:n.message,entityId:n.entity_id,entityType:n.entity_type,isRead:n.is_read,createdAt:n.created_at,chatId:n.entity_type==='chat'?n.entity_id:undefined,postId:n.entity_type==='post'?n.entity_id:undefined}));
 const state:AppState={residents,posts:await mapPosts(client,postRows??[]),businesses,businessOwners:ownBusiness?[{id:user.id,ownerName:residents.find(r=>r.id===user.id)?.name??'',email:user.email??'',businessId:ownBusiness.id,paymentStatus:ownBusiness.payment&&new Date(ownBusiness.payment.renewalDate)>new Date()?'paid':'unpaid'}]:[],
  chats,reports:db.reports.map(r=>({id:r.id,itemType:r.item_type,itemId:r.item_id,itemLabel:r.item_label,reason:r.reason,reportedBy:r.reporter_id,reportedUserIds:r.reported_user_id?[r.reported_user_id]:[],status:r.status,createdAt:r.created_at})),notifications:notifications.map(n=>({id:n.id,title:n.title,description:n.message,type:'Chat update' as const})),
  paymentPlans:db.pricing_plans.map(p=>({...p.data,id:p.id,name:p.name,price:p.amount_paise/100,amountPaise:p.amount_paise,features:p.data.features??[],description:p.data.description??''})),
  paymentHistory:db.payments.map(p=>({id:p.id,date:p.created_at,businessId:p.business_id,planName:db.pricing_plans.find(plan=>plan.id===p.plan_id)?.name??p.plan_id,mode:p.mode,refundedAmount:p.refunded_paise/100,amount:p.amount_paise/100,status:p.status,paymentId:p.razorpay_payment_id??p.id})),currentUserId:isBusiness?null:user.id,currentBusinessOwnerId:isBusiness?user.id:null,location:db.profile_private.find(p=>p.user_id===user.id)?.location??createEmptyLocation()};
 return {state,notifications,roles:db.account_roles.filter(r=>r.user_id===user.id).map(r=>r.role),onboardingComplete:db.profile_private.find(p=>p.user_id===user.id)?.onboarding_complete??false};
}
