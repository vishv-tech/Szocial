import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AppState, Business, Chat, LocalPost, ResidentUser, SzocialNotification } from "@/types";
import { createEmptyLocation } from "@/lib/location";
import { createInitialsAvatar } from "@/lib/user-photo";
// The API uses the user's cookie client, never service_role, for all ordinary reads.
// Flexible UI metadata remains JSON while identity/status/billing columns are authoritative.
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export async function rows(client:SupabaseClient, table:string, limit=500):Promise<Row[]> {
 const {data,error}=await client.from(table).select('*').limit(limit);
 if(error) throw new Error(`${table}: ${error.message}`);
 return data??[];
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
 const queries=await Promise.all(['comments','post_interests','post_saves','post_likes'].map(table=>client.from(table).select('*').in('post_id',ids)));
 for(const result of queries)if(result.error)throw result.error;
 const [comments,interests,saves,likes]=queries.map(r=>r.data??[]);
 return posts.map(p=>({...p.data,id:p.id,type:p.type,authorId:p.author_id,title:p.title,description:p.description,category:p.category,
  location:{...p.location,latitude:p.latitude,longitude:p.longitude},visibility:p.visibility,status:p.status,createdAt:p.created_at,updatedAt:p.updated_at,
  contactPreference:p.data.contactPreference??'Chat only',reports:0,distanceKm:0,
  comments:comments.filter(c=>c.post_id===p.id).map(c=>({id:c.id,userId:c.author_id,text:c.body,createdAt:c.created_at})),
  interestedUserIds:interests.filter(i=>i.post_id===p.id).map(i=>i.user_id),acceptedUserIds:interests.filter(i=>i.post_id===p.id&&i.status==='accepted').map(i=>i.user_id),
  savedByUserIds:saves.filter(i=>i.post_id===p.id).map(i=>i.user_id),likedByUserIds:likes.filter(i=>i.post_id===p.id).map(i=>i.user_id)
 }));
}
export async function appSnapshot(client:SupabaseClient,user:User) {
 const tables=['profiles','profile_private','account_roles','businesses','conversations','conversation_members','messages','blocks','reports','notifications','business_offers','business_saves','business_events','pricing_plans','payments','subscriptions'];
 const result=await Promise.all(tables.map(t=>rows(client,t)));
 const db=Object.fromEntries(tables.map((t,i)=>[t,result[i]]));
 const urls=await signedMedia(client);
 const residents:ResidentUser[]=db.profiles.map(p=>{
  const own=db.profile_private.find(x=>x.user_id===p.id);
  return {id:p.id,name:p.full_name,email:p.id===user.id?user.email??'':'',mobile:own?.mobile,
   avatar:urls.get(p.avatar_path)??createInitialsAvatar(p.full_name),profilePhoto:urls.get(p.avatar_path),bio:p.bio,
   age:own?.age,gender:own?.gender,location:own?.location??{area:p.area,city:p.city},verified:p.verified,status:p.account_status,
   joinedDate:p.created_at,reports:db.reports.filter(r=>r.reported_user_id===p.id).length,
   privacy:own?.privacy??{showAge:false,showExactArea:false,allowDirectMessages:true}};
 });
 const businesses:Business[]=db.businesses.map(b=>{
  const sub=db.subscriptions.find(s=>s.business_id===b.id),payment=db.payments.find(p=>p.id===sub?.payment_id&&p.status==='paid');
  const offers=db.business_offers.filter(o=>o.business_id===b.id);
  return {...b.data,id:b.id,ownerId:b.owner_id,name:b.name,category:b.category,status:b.status,verified:b.verified,featured:b.featured,createdAt:b.created_at,updatedAt:b.updated_at,
   location:b.data.location??createEmptyLocation(),address:b.data.address??'',phone:b.data.phone??'',hours:b.data.hours??'',about:b.data.about??'',services:b.data.services??[],tags:b.data.tags??[],priceRange:b.data.priceRange??'Mid-range',openStatus:b.data.openStatus??'Open',listedByResidents:false,
   logo:urls.get(b.data.logo)??createInitialsAvatar(b.name),coverImage:urls.get(b.data.coverImage)??'',gallery:(b.data.gallery??[]).map((p:string)=>urls.get(p)).filter(Boolean),
   offers:offers.map(o=>o.body),offerCreatedAt:Object.fromEntries(offers.map(o=>[o.body,o.created_at])),
   views:db.business_events.filter(e=>e.business_id===b.id&&e.kind==='view').length,saves:db.business_saves.filter(s=>s.business_id===b.id).length,messages:db.conversations.filter(c=>c.business_id===b.id).length,rating:0,reviews:0,
   payment:payment?{planId:payment.plan_id,planName:db.pricing_plans.find(p=>p.id===payment.plan_id)?.name??payment.plan_id,amountPaid:payment.amount_paise/100,paymentId:payment.razorpay_payment_id,status:'paid',renewalDate:sub!.active_until,paidAt:payment.verified_at,mock:false}:undefined};
 });
 const ownBusiness=businesses.find(b=>b.ownerId===user.id);
 const isBusiness=db.account_roles.some(r=>r.user_id===user.id&&r.role==='business');
 const chats:Chat[]=db.conversations.map(c=>{
  const members=db.conversation_members.filter(m=>m.conversation_id===c.id),other=members.find(m=>m.user_id!==user.id);
  const block=db.blocks.find(b=>members.some(m=>m.user_id===b.blocker_id)&&members.some(m=>m.user_id===b.blocked_id));
  const messages=db.messages.filter(m=>m.conversation_id===c.id).sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
  return {id:c.id,type:c.business_id?'Business':'Fun',name:residents.find(r=>r.id===other?.user_id)?.name??'Neighbour',avatar:'',location:'',status:block?'Blocked':'Active',
   blockedById:block?.blocker_id,blockedByType:block?.blocker_id===ownBusiness?.ownerId?'business':'resident',blockedAt:block?.created_at,
   participantIds:members.map(m=>m.user_id),participants:members.map(m=>({id:m.user_id,participantType:businesses.some(b=>b.ownerId===m.user_id)?'business':'resident',name:residents.find(r=>r.id===m.user_id)?.name??'Neighbour',profilePhoto:residents.find(r=>r.id===m.user_id)?.profilePhoto})),
   postId:c.post_id,businessId:c.business_id,createdAt:c.created_at,updatedAt:c.updated_at,lastMessageAt:messages.at(-1)?.created_at??c.created_at,
   readAtByParticipant:Object.fromEntries(members.filter(m=>m.read_at).map(m=>[m.user_id,m.read_at])),unread:0,
   messages:messages.map(m=>({id:m.id,senderId:m.sender_id,senderType:businesses.some(b=>b.ownerId===m.sender_id)?'business':'resident',text:m.body,kind:m.kind,createdAt:m.created_at,...(m.kind==='location'?{latitude:m.data.latitude,longitude:m.data.longitude,mapsUrl:`https://www.google.com/maps/search/?api=1&query=${m.data.latitude},${m.data.longitude}`,locationLabel:'Shared location'}:{})}))};
 });
 const {data:postRows,error:postError}=await client.from('posts').select('*').or(`author_id.eq.${user.id},status.eq.Active`).order('created_at',{ascending:false}).limit(100);
 if(postError)throw postError;
 const notifications:SzocialNotification[]=db.notifications.map(n=>({id:n.id,recipientId:n.recipient_id,recipientType:isBusiness?'business':'resident',senderId:n.sender_id??'',senderName:residents.find(r=>r.id===n.sender_id)?.name??'Szocial',type:n.type,title:n.title,message:n.message,entityId:n.entity_id,entityType:n.entity_type,isRead:n.is_read,createdAt:n.created_at,chatId:n.entity_type==='chat'?n.entity_id:undefined,postId:n.entity_type==='post'?n.entity_id:undefined}));
 const state:AppState={residents,posts:await mapPosts(client,postRows??[]),businesses,businessOwners:ownBusiness?[{id:user.id,ownerName:residents.find(r=>r.id===user.id)?.name??'',email:user.email??'',businessId:ownBusiness.id,paymentStatus:ownBusiness.payment&&new Date(ownBusiness.payment.renewalDate)>new Date()?'paid':'unpaid'}]:[],
  chats,reports:db.reports.map(r=>({id:r.id,itemType:r.item_type,itemId:r.item_id,itemLabel:r.item_label,reason:r.reason,reportedBy:r.reporter_id,reportedUserIds:r.reported_user_id?[r.reported_user_id]:[],status:r.status,createdAt:r.created_at})),notifications:[],
  paymentPlans:db.pricing_plans.map(p=>({...p.data,id:p.id,name:p.name,price:p.amount_paise/100,amountPaise:p.amount_paise,features:p.data.features??[],description:p.data.description??''})),
  paymentHistory:db.payments.map(p=>({id:p.id,date:p.created_at,businessId:p.business_id,planName:p.plan_id,amount:p.amount_paise/100,status:p.status==='paid'?'paid':p.status==='failed'?'failed':'unpaid',paymentId:p.razorpay_payment_id??p.id})),currentUserId:isBusiness?null:user.id,currentBusinessOwnerId:isBusiness?user.id:null,location:db.profile_private.find(p=>p.user_id===user.id)?.location??createEmptyLocation()};
 return {state,notifications,roles:db.account_roles.filter(r=>r.user_id===user.id).map(r=>r.role),onboardingComplete:db.profile_private.find(p=>p.user_id===user.id)?.onboarding_complete??false};
}
