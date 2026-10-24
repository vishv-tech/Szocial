"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { AppState, BusinessStatus, ReportReason, ResidentUser, SzocialNotification } from "@/types";
import type { BusinessProfileInput, BusinessSignupInput, CreatePostInput, ResidentSignupInput, SendChatMessageInput } from "@/lib/store-inputs";
import { createEmptyLocation, formatUserLocation, normalizeUserLocation } from "@/lib/location";
import { createInitialsAvatar } from "@/lib/user-photo";
import { ApiError, api, uploadImage, deleteImage } from "@/lib/client-api";
import { browserSupabase } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {SignupOutcome} from "@/lib/auth-flow";
import { retireLegacyCredentials } from "@/lib/resident-auth";
import { useToast } from "@/components/ToastProvider";

function emptyState():AppState {
 return {residents:[],posts:[],businesses:[],businessOwners:[],chats:[],reports:[],notifications:[],paymentPlans:[],paymentHistory:[],currentUserId:null,currentBusinessOwnerId:null,location:createEmptyLocation()};
}
const visitor:ResidentUser={id:'',name:'Resident',email:'',avatar:createInitialsAvatar('Resident'),location:createEmptyLocation(),verified:false,bio:'',status:'Active',joinedDate:'',reports:0,privacy:{showAge:false,showExactArea:false,allowDirectMessages:true}};
type Snapshot={state:AppState;notifications:SzocialNotification[];roles:string[];onboardingComplete:boolean};
function useStoreValue() {
 const {notify}=useToast();
 const [state,setState]=useState<AppState>(emptyState),[hydrated,setHydrated]=useState(false),[error,setError]=useState(''),[notifications,setNotifications]=useState<SzocialNotification[]>([]),[revision,setRevision]=useState(0),[roles,setRoles]=useState<string[]>([]),[onboardingComplete,setOnboardingComplete]=useState(false);
 const feedSignature=useRef('');
 const requestSerial=useRef(0),inFlight=useRef(new Map<string,Promise<{id:string;success:boolean}|null>>());
 const reload=useCallback(async()=>{
  const serial=++requestSerial.current;
  try {
   const result=await api<Snapshot>('/api/app');
   if(serial!==requestSerial.current)return;
   setState(previous=>({...result.state,chats:result.state.chats.map(chat=>{const old=previous.chats.find(c=>c.id===chat.id);return old&&previous.currentUserId===result.state.currentUserId&&previous.currentBusinessOwnerId===result.state.currentBusinessOwnerId&&old.messages[0]?.createdAt<chat.messages[0]?.createdAt?{...chat,messages:[...new Map([...old.messages,...chat.messages].map(m=>[m.id,m])).values()],historyHasMore:old.historyHasMore}:chat;})}));setNotifications(result.notifications);setRoles(result.roles);setOnboardingComplete(result.onboardingComplete);setError('');const signature=JSON.stringify(result.state.posts);if(signature!==feedSignature.current){feedSignature.current=signature;setRevision(n=>n+1);}
  }catch(e){if(serial===requestSerial.current){setState(emptyState());setNotifications([]);setRoles([]);setError(e instanceof Error?e.message:'Unable to load account');}}
  finally {if(serial===requestSerial.current)setHydrated(true);}
 },[]);
 useEffect(()=>{
  retireLegacyCredentials();
  if(!isSupabaseConfigured()){setError('Supabase configuration is required.');setHydrated(true);return;}
  void reload();
  const client=browserSupabase();let timer:ReturnType<typeof setTimeout>;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>void reload(),200);};
  const {data:{subscription}}=client.auth.onAuthStateChange((event:string)=>{if(event==='SIGNED_OUT'){++requestSerial.current;setState(emptyState());setNotifications([]);setRoles([]);inFlight.current.clear();}schedule();});
  // Each table is protected by RLS. A data refresh is debounced, not a second write.
  const channel=client.channel(`szocial-${crypto.randomUUID()}`);
  for(const table of ['messages','conversations','blocks','notifications','posts','comments','post_interests','reports','conversation_members','profiles','businesses','business_offers','post_likes','post_saves','business_saves','payments','subscriptions'])channel.on('postgres_changes',{event:'*',schema:'public',table},schedule);
  channel.subscribe((status:string)=>{if(status==='SUBSCRIBED')schedule();});window.addEventListener('focus',schedule);
  const refresh=setInterval(schedule,30*1000);
  return()=>{clearTimeout(timer);clearInterval(refresh);subscription.unsubscribe();void client.removeChannel(channel);window.removeEventListener('focus',schedule);};
 },[reload]);
 const run=useCallback(async(action:string,args:Record<string,unknown>={})=>{
  const key=JSON.stringify([action,args]);
  if(inFlight.current.has(key))return inFlight.current.get(key)!;
  const task=(async()=>{
   try{const result=await api<{id:string;success:boolean}>('/api/app',{action,args});await reload();return result;}
   catch(e){notify({title:'Changes were not saved',description:e instanceof Error?e.message:'Try again.',variant:'warning'});return null;}
   finally{inFlight.current.delete(key);}
  })();inFlight.current.set(key,task);return task;
 },[notify,reload]);
 const currentUser=state.residents.find(r=>r.id===(state.currentUserId??state.currentBusinessOwnerId))??visitor;
 const currentBusinessOwner=state.businessOwners.find(o=>o.id===state.currentBusinessOwnerId)??null;
 const currentBusiness=state.businesses.find(b=>b.id===currentBusinessOwner?.businessId)??null;
 const businessId=()=>{if(!currentBusiness)throw new Error('No authorized business');return currentBusiness.id;};
 const auth=async(action:string,body:unknown)=>{
  try{await api('/api/auth/'+action,body);await reload();return true;}
  catch(e){notify({title:'Authentication failed',description:e instanceof Error?e.message:'Try again',variant:'warning'});return false;}
 };
 const [signupDraft,setSignupDraft]=useState<{name:string;email:string;location:AppState['location'];profilePhoto?:string;mobile?:string;age?:number;gender?:ResidentUser['gender'];businessName?:string;address?:string;category?:BusinessSignupInput['category']}|null>(null);
 const signupLock=useRef(false),acceptedSignup=useRef(new Map<string,SignupOutcome>());
 const signup=async(email:string,password:string,name:string,business:boolean,draft:NonNullable<typeof signupDraft>):Promise<SignupOutcome>=>{
  const key=email.trim().toLowerCase();const accepted=acceptedSignup.current.get(key);if(accepted)return accepted;
  if(signupLock.current)return {outcome:'rejected',message:'Account creation is already in progress.'};
  signupLock.current=true;
  try{
   const result=await api<Extract<SignupOutcome,{next:string}>>('/api/auth/signup',{email,password,name,business});
   if(result.outcome!=='confirmation_required'&&result.outcome!=='authenticated')return {outcome:'uncertain',message:'We could not confirm the result. Check your inbox or try signing in before submitting again.'};
   acceptedSignup.current.set(key,result);setSignupDraft(draft);
   if(result.outcome==='authenticated')await reload();
   return result;
  }catch(error){const outcome=error instanceof ApiError&&(error.status===429||error.outcome==='rate_limited')?'rate_limited':error instanceof ApiError&&error.outcome==='rejected'?'rejected':'uncertain';return {outcome,message:outcome==='uncertain'?'We could not confirm the result. Check your inbox or try signing in before submitting another signup.':error instanceof Error?error.message:'Please try again later.',retryAfter:error instanceof ApiError?error.retryAfter:undefined};}
  finally{signupLock.current=false;}
 };
 const signupResident=async(input:ResidentSignupInput)=>signup(input.email,input.password,input.name,false,{name:input.name,email:input.email,location:input.location,profilePhoto:input.profilePhoto,mobile:input.mobile,age:input.age,gender:input.gender});
 const signupBusiness=async(input:BusinessSignupInput)=>signup(input.email,input.password,input.ownerName,true,{name:input.ownerName,email:input.email,location:input.location,businessName:input.businessName,address:input.address,category:input.category});
 const login=async(email:string,password:string,business=false)=>{try{const result=await api<{next:string}>('/api/auth/login',{email,password,business});await reload();return result.next;}catch(error){notify({title:'Authentication failed',description:error instanceof Error?error.message:'Please try again.',variant:'warning'});return null;}};
 const loginResident=async(email:string,password:string)=>login(email,password);
 const logoutResident=async()=>{if(!await auth('logout',{}))return false;setState(emptyState());setNotifications([]);setSignupDraft(null);return true;};
 const loginBusiness=async(email:string,password:string)=>login(email,password,true);
 const updateResidentProfile=async(input:Partial<ResidentUser>)=>{
  try{
   const changes={...input};
   if(changes.profilePhoto?.startsWith('data:'))changes.profilePhoto=await uploadImage(changes.profilePhoto,'avatar');
   // Signed preview URLs are not persisted as storage references.
   else if(changes.profilePhoto?.startsWith('http'))delete changes.profilePhoto;
   const saved=Boolean(await run('profile',changes));
   if(saved&&Object.hasOwn(changes,'profilePhoto')&&currentUser.avatarPath&&changes.profilePhoto!==currentUser.avatarPath)void deleteImage(currentUser.avatarPath).catch(()=>{});
   return saved;
  }catch(e){notify({title:'Profile not saved',description:e instanceof Error?e.message:'Upload failed',variant:'warning'});return false;}
 };
 const setLocation=useCallback(async(location:AppState['location'])=>{
  const normalized=normalizeUserLocation(location);if(!normalized)return false;
  const saved=Boolean(await run('profile',{location:normalized}));if(saved)notify({title:'Location updated'});return saved;
 },[run,notify]);
 const updateBusinessProfile=async(input:BusinessProfileInput)=>{const saved=Boolean(await run('business_profile',{...input,id:businessId()}));if(saved){const old=currentBusiness?.mediaPaths;const retained=[input.logo??old?.logo,input.coverImage??old?.coverImage,...(input.gallery??old?.gallery??[])];for(const path of [old?.logo,old?.coverImage,...old?.gallery??[]])if(path&&!retained.includes(path))void deleteImage(path).catch(()=>{});}return saved;};
 const pendingPosts=useRef(new Map<string,string>());
 const createPost=async(input:CreatePostInput,images:File[]=[])=>{
  const key=JSON.stringify([currentUser.id,input]);const paths:string[]=[];
  const id=pendingPosts.current.get(key)??(await run('create_post',{...input,withImages:images.length>0}))?.id;
  if(!id)return '';if(images.length)pendingPosts.current.set(key,id);
  try{if(images.length){for(const file of images)paths.push(await uploadImage(file,'post',id));if(!await run('update_post',{id,images:paths,status:'Active'}))throw new Error('Images were not attached. Retry this draft.');}pendingPosts.current.delete(key);return id;}
  catch(e){for(const path of paths)void deleteImage(path).catch(()=>{});notify({title:'Post saved as draft',description:e instanceof Error?e.message:'Image upload failed. Open My Posts to retry.',variant:'warning'});return '';}
 };
 const startPostChat=async(postId:string)=>(await run('start_chat',{postId}))?.id??'';
 const startBusinessChat=async(id:string)=>(await run('start_chat',{businessId:id}))?.id??'';
 const sendChatMessage=async(id:string,input:string|SendChatMessageInput)=>{
  const message=typeof input==='string'?{text:input}:input;
  if(!message.text.trim())return false;
  const saved=Boolean(await run('message',{...message,id,clientId:messageKeys.current.get(JSON.stringify([currentUser.id,id,message]))??(()=>{const key=crypto.randomUUID();messageKeys.current.set(JSON.stringify([currentUser.id,id,message]),key);return key;})()}));if(saved)messageKeys.current.delete(JSON.stringify([currentUser.id,id,message]));return saved;
 };
 const messageKeys=useRef(new Map<string,string>());
 const loadOlderMessages=async(id:string)=>{const chat=state.chats.find(c=>c.id===id),first=chat?.messages[0];if(!first)return;try{const page=await api<{messages:AppState['chats'][number]['messages'];hasMore:boolean}>(`/api/messages?${new URLSearchParams({id,before:first.createdAt,beforeId:first.id})}`);setState(previous=>({...previous,chats:previous.chats.map(c=>c.id===id?{...c,messages:[...new Map([...page.messages,...c.messages].map(m=>[m.id,m])).values()],historyHasMore:page.hasMore}:c)}));}catch(e){notify({title:'History unavailable',description:e instanceof Error?e.message:'Retry',variant:'warning'});}};
 const blockChat=async(id:string)=>{const chat=state.chats.find(c=>c.id===id);return Boolean(await run('block',{id,blocked:!(chat?.blockedByIds??[chat?.blockedById]).includes(currentUser.id)}));};
 const markChatRead=useCallback(async(id:string)=>{const chat=state.chats.find(c=>c.id===id);const actor=state.currentBusinessOwnerId??state.currentUserId;if(!chat||!actor)return;const read=chat.readAtByParticipant?.[actor];if(read&&read>=(chat.lastMessageAt??''))return;await run('read_chat',{id});},[run,state.chats,state.currentUserId,state.currentBusinessOwnerId]);
 const submitReport=async(itemType:'Post'|'User'|'Business'|'Chat',id:string,itemLabel:string,reason:ReportReason)=>Boolean(await run('report',{id,itemType,itemLabel,reason}));
 const residentNotifications=state.currentBusinessOwnerId?[]:notifications,businessNotifications=state.currentBusinessOwnerId?notifications:[];
 return {state,hydrated,error,revision,roles,onboardingComplete,signupDraft,reload,currentUser,currentBusinessOwner,currentBusiness,locationLabel:formatUserLocation(state.location),residentNotifications,businessNotifications,
  residentUnreadCount:residentNotifications.filter(n=>!n.isRead).length,businessUnreadCount:businessNotifications.filter(n=>!n.isRead).length,
  setLocation,signupResident,loginResident,logoutResident,signupBusiness,loginBusiness,logoutBusiness:logoutResident,updateResidentProfile,
  updatePrivacy:async(privacy:ResidentUser['privacy'])=>updateResidentProfile({privacy}),submitVerification:async()=>run('verification_request'),
  toggleInterest:async(id:string)=>run('interest',{id}),offerHelp:async(id:string)=>run('interest',{id}),addComment:async(id:string,text:string)=>run('comment',{id,text}),toggleLike:async(id:string)=>run('like',{id}),toggleSavePost:async(id:string)=>run('save_post',{id}),
  toggleSaveBusiness:async(id:string)=>run('save_business',{id}),createPost,updatePost:async(id:string,input:Partial<AppState['posts'][number]>)=>run('update_post',{...input,id}),deletePost:async(id:string)=>run('delete_post',{id}),closePost:async(id:string)=>run('close_post',{id}),
  acceptInterestedUser:async(id:string,userId:string)=>{return (await run('accept',{id,userId}))?.id??'';},rejectInterestedUser:async(id:string,userId:string)=>run('reject',{id,userId}),
  submitReport,startPostChat,startBusinessChat,loadOlderMessages,sendChatMessage,blockChat,markChatRead,
  markResidentNotificationsRead:async()=>run('read_notifications'),markBusinessNotificationsRead:async()=>run('read_notifications'),
  getBusinessNextRoute:()=>currentBusiness?'/business/dashboard':'/onboarding?business=1',
  // Payment success is refreshed from verified database state, never granted by a browser call.
  completeBusinessPayment:async()=>{await reload();},
  failBusinessPayment:async()=>{await reload();},
  saveBusinessMedia:async(input:{logo?:string;coverImage?:string;gallery?:string[]})=>Boolean(await run('business_profile',{...input,id:businessId()})),
  updateBusinessProfile,publishBusiness:async()=>Boolean(await run('business_status',{id:businessId(),status:'Pending Approval'})),
  setCurrentBusinessStatus:async(status:BusinessStatus)=>run('business_status',{id:businessId(),status}),addBusinessOffer:async(text:string)=>run('offer',{id:businessId(),text}),cancelBusinessPlan:async()=>run('cancel_subscription',{id:businessId()}),
  setUserStatus:async(id:string,status:ResidentUser['status'])=>run('admin_user_status',{id,status}),verifyUser:async(id:string)=>run('admin_verify_user',{id}),setBusinessAdminStatus:async(id:string,status:BusinessStatus)=>run('admin_business_status',{id,status}),verifyBusiness:async(id:string)=>run('admin_verify_business',{id}),featureBusiness:async(id:string)=>run('admin_feature_business',{id}),
  removePostAdmin:async(id:string)=>run('admin_remove_post',{id}),resolveReport:async(id:string)=>run('admin_resolve_report',{id})};
}
const StoreContext=createContext<ReturnType<typeof useStoreValue>|null>(null);
export function AppStoreProvider({children}:{children:ReactNode}) {
 const value=useStoreValue();return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
export function useAppStore(){const value=useContext(StoreContext);if(!value)throw new Error('AppStoreProvider is required');return value;}
