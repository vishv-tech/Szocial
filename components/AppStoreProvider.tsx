"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AppState, BusinessStatus, PaymentPlan, PaymentStatus, ReportReason, ResidentUser, SzocialNotification } from "@/types";
import type { BusinessProfileInput, BusinessSignupInput, CreatePostInput, ResidentSignupInput, SendChatMessageInput } from "@/lib/store-inputs";
import { createEmptyLocation, formatUserLocation, normalizeUserLocation } from "@/lib/location";
import { createInitialsAvatar } from "@/lib/user-photo";
import { api, uploadImage } from "@/lib/client-api";
import { browserSupabase } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useToast } from "@/components/ToastProvider";

function emptyState():AppState {
 return {residents:[],posts:[],businesses:[],businessOwners:[],chats:[],reports:[],notifications:[],paymentPlans:[],paymentHistory:[],currentUserId:null,currentBusinessOwnerId:null,location:createEmptyLocation()};
}
const visitor:ResidentUser={id:'',name:'Resident',email:'',avatar:createInitialsAvatar('Resident'),location:createEmptyLocation(),verified:false,bio:'',status:'Active',joinedDate:'',reports:0,privacy:{showAge:false,showExactArea:false,allowDirectMessages:true}};
type Snapshot={state:AppState;notifications:SzocialNotification[];roles:string[];onboardingComplete:boolean};
function useStoreValue() {
 const {notify}=useToast();
 const [state,setState]=useState<AppState>(emptyState),[hydrated,setHydrated]=useState(false),[error,setError]=useState(''),[notifications,setNotifications]=useState<SzocialNotification[]>([]),[revision,setRevision]=useState(0),[roles,setRoles]=useState<string[]>([]),[onboardingComplete,setOnboardingComplete]=useState(false);
 const requestSerial=useRef(0),inFlight=useRef(new Map<string,Promise<{id:string;success:boolean}|null>>());
 const reload=useCallback(async()=>{
  const serial=++requestSerial.current;
  try {
   const result=await api<Snapshot>('/api/app');
   if(serial!==requestSerial.current)return;
   setState(result.state);setNotifications(result.notifications);setRoles(result.roles);setOnboardingComplete(result.onboardingComplete);setError('');setRevision(n=>n+1);
  }catch(e){if(serial===requestSerial.current){setState(emptyState());setNotifications([]);setRoles([]);setError(e instanceof Error?e.message:'Unable to load account');}}
  finally {if(serial===requestSerial.current)setHydrated(true);}
 },[]);
 useEffect(()=>{
  if(!isSupabaseConfigured()){setError('Supabase configuration is required.');setHydrated(true);return;}
  void reload();
  const client=browserSupabase();let timer:ReturnType<typeof setTimeout>;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>void reload(),200);};
  const {data:{subscription}}=client.auth.onAuthStateChange(schedule);
  // Each table is protected by RLS. A data refresh is debounced, not a second write.
  const channel=client.channel(`szocial-${crypto.randomUUID()}`);
  for(const table of ['messages','conversations','blocks','notifications','posts','comments','post_interests','reports'])channel.on('postgres_changes',{event:'*',schema:'public',table},schedule);
  channel.subscribe();window.addEventListener('focus',schedule);
  const refresh=setInterval(schedule,50*60*1000);
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
 const signupResident=async(input:ResidentSignupInput)=>{
  if(!await auth('signup',{email:input.email,password:input.password,name:input.name}))return false;
  const {data:{user}}=await browserSupabase().auth.getUser();
  if(!user){notify({title:'Check your email',description:'Verify your address, then sign in to complete your profile.'});return false;}
  let photo:string|undefined;
  if(input.profilePhoto)photo=await uploadImage(input.profilePhoto,'avatar');
  return Boolean(await run('profile',{name:input.name,mobile:input.mobile,age:input.age,gender:input.gender,location:input.location,...(photo?{profilePhoto:photo}:{})}));
 };
 const loginResident=async(email:string,password:string)=>auth('login',{email,password});
 const logoutResident=async()=>{if(await auth('logout',{})){setState(emptyState());setNotifications([]);}};
 const signupBusiness=async(input:BusinessSignupInput)=>{
  if(!await auth('signup',{email:input.email,password:input.password,name:input.ownerName}))return false;
  const {data:{user}}=await browserSupabase().auth.getUser();
  if(!user){notify({title:'Verify your email',description:'After verification, choose business setup on the onboarding page.'});return false;}
  return Boolean(await run('create_business',input));
 };
 const loginBusiness=async(email:string,password:string)=>{
  if(!await loginResident(email,password))return null;
  const snapshot=await api<Snapshot>('/api/app');
  return snapshot.state.businessOwners.length?'/business/dashboard':'/onboarding?business=1';
 };
 const updateResidentProfile=async(input:Partial<ResidentUser>)=>{
  try{
   const changes={...input};
   if(changes.profilePhoto?.startsWith('data:'))changes.profilePhoto=await uploadImage(changes.profilePhoto,'avatar');
   // Signed preview URLs are not persisted as storage references.
   else if(changes.profilePhoto?.startsWith('http'))delete changes.profilePhoto;
   return Boolean(await run('profile',changes));
  }catch(e){notify({title:'Profile not saved',description:e instanceof Error?e.message:'Upload failed',variant:'warning'});return false;}
 };
 const setLocation=useCallback(async(location:AppState['location'])=>{
  const normalized=normalizeUserLocation(location);if(!normalized)return;
  if(await run('profile',{location:normalized}))notify({title:'Location updated'});
 },[run,notify]);
 const updateBusinessProfile=async(input:BusinessProfileInput)=>Boolean(await run('business_profile',{...input,id:businessId()}));
 const createPost=async(input:CreatePostInput)=>(await run('create_post',input))?.id??'';
 const startPostChat=async(postId:string)=>(await run('start_chat',{postId}))?.id??'';
 const startBusinessChat=async(id:string)=>(await run('start_chat',{businessId:id}))?.id??'';
 const sendChatMessage=async(id:string,input:string|SendChatMessageInput)=>{
  const message=typeof input==='string'?{text:input}:input;
  if(!message.text.trim())return false;
  return Boolean(await run('message',{...message,id,clientId:crypto.randomUUID()}));
 };
 const blockChat=async(id:string)=>{const chat=state.chats.find(c=>c.id===id);return Boolean(await run('block',{id,blocked:chat?.blockedById===currentUser.id?false:true}));};
 const markChatRead=useCallback(async(id:string)=>{const chat=state.chats.find(c=>c.id===id);const actor=state.currentBusinessOwnerId??state.currentUserId;if(!chat||!actor)return;const read=chat.readAtByParticipant?.[actor];if(read&&read>=(chat.lastMessageAt??''))return;await run('read_chat',{id});},[run,state.chats,state.currentUserId,state.currentBusinessOwnerId]);
 const submitReport=async(itemType:'Post'|'User'|'Business'|'Chat',id:string,itemLabel:string,reason:ReportReason)=>Boolean(await run('report',{id,itemType,itemLabel,reason}));
 const residentNotifications=state.currentBusinessOwnerId?[]:notifications,businessNotifications=state.currentBusinessOwnerId?notifications:[];
 return {state,hydrated,error,revision,roles,onboardingComplete,reload,currentUser,currentBusinessOwner,currentBusiness,locationLabel:formatUserLocation(state.location),residentNotifications,businessNotifications,
  residentUnreadCount:residentNotifications.filter(n=>!n.isRead).length,businessUnreadCount:businessNotifications.filter(n=>!n.isRead).length,
  setLocation,signupResident,loginResident,logoutResident,signupBusiness,loginBusiness,logoutBusiness:logoutResident,updateResidentProfile,
  updatePrivacy:async(privacy:ResidentUser['privacy'])=>updateResidentProfile({privacy}),submitVerification:async()=>run('verification_request'),
  toggleInterest:async(id:string)=>run('interest',{id}),offerHelp:async(id:string)=>run('interest',{id}),addComment:async(id:string,text:string)=>run('comment',{id,text}),toggleLike:async(id:string)=>run('like',{id}),toggleSavePost:async(id:string)=>run('save_post',{id}),
  toggleSaveBusiness:async(id:string)=>run('save_business',{id}),createPost,updatePost:async(id:string,input:Partial<AppState['posts'][number]>)=>run('update_post',{...input,id}),deletePost:async(id:string)=>run('delete_post',{id}),closePost:async(id:string)=>run('close_post',{id}),
  acceptInterestedUser:async(id:string,userId:string)=>{if(!await run('accept',{id,userId}))return '';return '';},rejectInterestedUser:async(id:string,userId:string)=>run('reject',{id,userId}),
  submitReport,startPostChat,startBusinessChat,sendChatMessage,blockChat,markChatRead,
  markResidentNotificationsRead:async()=>run('read_notifications'),markBusinessNotificationsRead:async()=>run('read_notifications'),
  getBusinessNextRoute:()=>currentBusiness?'/business/dashboard':'/onboarding?business=1',
  // Payment success is refreshed from verified database state, never granted by a browser call.
  completeBusinessPayment:async(_plan:PaymentPlan,_paymentId:string,_mock:boolean)=>{await reload();},
  failBusinessPayment:async(_plan:PaymentPlan)=>{await reload();},
  updateBusinessProfile,publishBusiness:async()=>Boolean(await run('business_status',{id:businessId(),status:'Pending Approval'})),
  setCurrentBusinessStatus:async(status:BusinessStatus)=>run('business_status',{id:businessId(),status}),addBusinessOffer:async(text:string)=>run('offer',{id:businessId(),text}),cancelBusinessPlan:async()=>run('cancel_subscription',{id:businessId()}),
  setUserStatus:async(id:string,status:ResidentUser['status'])=>run('admin_user_status',{id,status}),verifyUser:async(id:string)=>run('admin_verify_user',{id}),setBusinessAdminStatus:async(id:string,status:BusinessStatus)=>run('admin_business_status',{id,status}),verifyBusiness:async(id:string)=>run('admin_verify_business',{id}),featureBusiness:async(id:string)=>run('admin_feature_business',{id}),
  setBusinessPaymentStatus:async(_id:string,_status:PaymentStatus)=>{notify({title:'Payments can only change through verified provider reconciliation',variant:'warning'});},
  removePostAdmin:async(id:string)=>run('admin_remove_post',{id}),resolveReport:async(id:string)=>run('admin_resolve_report',{id})};
}
const StoreContext=createContext<ReturnType<typeof useStoreValue>|null>(null);
export function AppStoreProvider({children}:{children:ReactNode}) {
 const value=useStoreValue();return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
export function useAppStore(){const value=useContext(StoreContext);if(!value)throw new Error('AppStoreProvider is required');return value;}
