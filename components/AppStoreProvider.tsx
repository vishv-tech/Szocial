"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {usePathname} from "next/navigation";
import {FeedCache,type Change} from "@/lib/feed-cache";
import {SyncScheduler} from "@/lib/sync-scheduler";
import {mergePatch,mergeRows,pageDomains,mutationDomains,type Domain} from "@/lib/app-sync";
import type { AppState, BusinessStatus, ReportReason, ResidentUser, SzocialNotification, PostAuthor, AdminStatistics } from "@/types";
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
type Snapshot={stats?:AdminStatistics;actorId?:string;domain?:Domain;state:Partial<AppState>;notifications?:SzocialNotification[];roles?:string[];onboardingComplete?:boolean;unreadCount?:number;page?:{hasMore:boolean;nextOffset:number;total:number|null}};
function useStoreValue(){
 const {notify}=useToast(),path=usePathname(),pathRef=useRef(path);pathRef.current=path;
 const [state,setState]=useState<AppState>(emptyState),[hydrated,setHydrated]=useState(false),[error,setError]=useState(''),[notifications,setNotifications]=useState<SzocialNotification[]>([]),[revision]=useState(0),[roles,setRoles]=useState<string[]>([]),[onboardingComplete,setOnboardingComplete]=useState(false),[pages,setPages]=useState<Partial<Record<Domain,{hasMore:boolean;nextOffset:number;total:number|null}>>>({}),[unread,setUnread]=useState<number|undefined>();
 const [stats,setStats]=useState<AdminStatistics>();
 const stateRef=useRef(state);stateRef.current=state;
 const epoch=useRef(0),actor=useRef<string|null>(null),verifiedAt=useRef(0),requests=useRef(new Map<Domain,Promise<void>>()),controllers=useRef(new Map<Domain,AbortController>()),loaded=useRef(new Set<Domain>()),connection=useRef('CONNECTING'),inFlight=useRef(new Map<string,Promise<{id:string;success:boolean;message?:AppState['chats'][number]['messages'][number];readAt?:string}|null>>());
 const scheduler=useRef<SyncScheduler|null>(null),dirtyDomains=useRef(new Set<Domain>());
 const scheduleResource=useCallback((domain:Domain)=>{dirtyDomains.current.add(domain);if(domain==='core'||domain==='notifications'||pageDomains(pathRef.current).includes(domain))scheduler.current?.schedule(domain);},[]);
 const activeThread=useRef<string|null>(null);const setActiveThread=useCallback((id:string|null)=>{activeThread.current=id;},[]);
 const closeRealtime=useRef<(()=>void)|null>(null);
 const lastReconcile=useRef(Date.now()),lastFocus=useRef(0),scopes=useRef(new Map<Domain,string>());
 const catalogLocation=useRef<string|null>(null);
 const businessFilters=useRef({query:'',category:'All'});const setBusinessFilters=useCallback((query:string,category:string)=>{if(query===businessFilters.current.query&&category===businessFilters.current.category)return;businessFilters.current={query,category};scheduleResource('businesses');},[scheduleResource]);
 const requestScopes=useRef(new Map<Domain,string>());
 const windows=useRef(new Map<Domain,{scope:string;pages:Snapshot[]}>());
 const mediaCache=useRef(new Map<string,{url:string;expires:number}>());
 const clear=useCallback(()=>{epoch.current++;scheduler.current?.reset();activeThread.current=null;closeRealtime.current?.();setSignupDraft(null);acceptedSignup.current.clear();messageKeys.current.clear();pendingPosts.current.clear();inFlight.current.clear();threadRequests.current.clear();actor.current=null;verifiedAt.current=0;controllers.current.forEach(c=>c.abort());controllers.current.clear();requests.current.clear();loaded.current.clear();dirtyDomains.current.clear();mediaCache.current.clear();windows.current.clear();scopes.current.clear();requestScopes.current.clear();catalogLocation.current=null;businessFilters.current={query:'',category:'All'};setState(emptyState());setNotifications([]);setRoles([]);setUnread(undefined);setStats(undefined);setPages({});setOnboardingComplete(false);},[]);
 const feeds=useRef<FeedCache|null>(null);if(!feeds.current)feeds.current=new FeedCache(async(url,signal)=>{const version=epoch.current,data=await api<{actorId?:string;posts:AppState['posts'];people?:PostAuthor[];hasMore:boolean}>(url,undefined,signal);if(version!==epoch.current)return {posts:[],hasMore:false};if(data.actorId&&actor.current&&data.actorId!==actor.current){scheduler.current?.schedule('core');throw new ApiError('Account changed',401);}verifiedAt.current=Date.now();if(data.people){const people=new Map(data.people.map(p=>[p.id,p]));data.posts=data.posts.map(p=>({...p,author:people.get(p.authorId),people:[...new Set([p.authorId,...p.comments.map(c=>c.userId)])].map(id=>people.get(id)).filter((p):p is PostAuthor=>Boolean(p))}));}retainMedia({state:{posts:data.posts}});return data;},()=>{clear();feeds.current?.clear();scheduler.current?.schedule('core');});
 const retainMedia=useCallback((result:Snapshot)=>{
  const keep=(path:string|undefined,url:string|undefined)=>{if(!path||!url)return url;const cached=mediaCache.current.get(path);if(cached&&cached.expires>Date.now())return cached.url;mediaCache.current.set(path,{url,expires:Date.now()+55*60000});if(mediaCache.current.size>2000)mediaCache.current.delete(mediaCache.current.keys().next().value!);return url;};
  result.state.residents?.forEach(r=>{r.profilePhoto=keep(r.avatarPath,r.profilePhoto);if(r.profilePhoto)r.avatar=r.profilePhoto;});
  result.state.businesses?.forEach(b=>{b.logo=keep(b.mediaPaths?.logo,b.logo)??b.logo;b.coverImage=keep(b.mediaPaths?.coverImage,b.coverImage)??b.coverImage;b.gallery=b.gallery.map((url,i)=>keep(b.mediaPaths?.gallery[i],url)??url);});
  result.state.posts?.forEach(p=>{for(const person of [p.author,...p.people??[]])if(person){person.profilePhoto=keep(person.avatarPath,person.profilePhoto);}p.images=p.images?.map((url,i)=>keep(p.imagePaths?.[i],url)??url);});
  return result;
 },[]);
 const loadResource=useCallback(async(domain:Domain,append=false)=>{
  const startedPath=pathRef.current,own=startedPath.startsWith('/business/'),admin=startedPath.startsWith('/admin'),detail=startedPath.startsWith('/businesses/')?startedPath.split('/')[2]:'';
  const queryMeta=domain==='businesses'&&!own&&!admin&&!detail?new URLSearchParams({q:startedPath==='/home'?'':businessFilters.current.query,category:startedPath==='/home'?'All':businessFilters.current.category,area:stateRef.current.location.area??'',city:stateRef.current.location.city??'',...(stateRef.current.location.latitude!=null&&stateRef.current.location.longitude!=null?{lat:String(stateRef.current.location.latitude),lng:String(stateRef.current.location.longitude)}:{}),...(startedPath==='/home'?{preview:'1'}:{})}).toString():'';
  const scope=domain==='businesses'?`${own}:${detail}:${startedPath}:${queryMeta}`:domain==='posts'?String(admin):'';
  if(requests.current.has(domain)){if(requestScopes.current.get(domain)===scope)return requests.current.get(domain)!;controllers.current.get(domain)?.abort();requests.current.delete(domain);}
  requestScopes.current.set(domain,scope);dirtyDomains.current.delete(domain);
  const version=epoch.current,abort=new AbortController();controllers.current.set(domain,abort);
  const task=(async()=>{try{
   const old=windows.current.get(domain),previous=old?.scope===scope?old.pages:[];
   const depth=append?previous.length+1:Math.max(1,previous.length),batch:Snapshot[]=append?[...previous]:[];
   for(let page=append?previous.length:0;page<depth;page++){
    const result=await api<Snapshot>(`/api/app?domain=${domain}&offset=${page*30}${own?'&own=1':''}${admin?'&scope=all':''}${detail?'&id='+encodeURIComponent(detail):''}${queryMeta?'&'+queryMeta:''}`,undefined,abort.signal);if(version!==epoch.current||abort.signal.aborted)return;retainMedia(result);batch.push(result);if(!result.page?.hasMore)break;
   }
   const result:Snapshot={...batch[0],state:{}};
   for(const item of batch){for(const [key,value] of Object.entries(item.state)){const previous=(result.state as Record<string,unknown>)[key];(result.state as Record<string,unknown>)[key]=Array.isArray(value)&&Array.isArray(previous)?mergeRows(previous,value):value;}if(item.notifications)result.notifications=mergeRows(result.notifications??[],item.notifications);}
   result.page=batch.at(-1)?.page;
   if(version!==epoch.current||abort.signal.aborted)return;
   const id=result.actorId??result.state.currentUserId??result.state.currentBusinessOwnerId??null;
   if(actor.current&&id&&actor.current!==id){clear();feeds.current?.clear();scheduler.current?.schedule('core');return;}
   windows.current.set(domain,{scope,pages:batch});if(id)actor.current=id;verifiedAt.current=Date.now();
   setState(previous=>mergePatch(previous,result.state,detail?'core':domain,false,admin));
   if(result.notifications)setNotifications(previous=>mergeRows(previous,result.notifications!,true));
   if(result.stats)setStats(result.stats);
   if(result.roles)setRoles(previous=>JSON.stringify(previous)===JSON.stringify(result.roles)?previous:result.roles!);
   if(result.onboardingComplete!==undefined)setOnboardingComplete(result.onboardingComplete);
   if(result.unreadCount!==undefined)setUnread(result.unreadCount);
   if(result.page)setPages(previous=>({...previous,[domain]:result.page!}));
   loaded.current.add(domain);scopes.current.set(domain,domain==='businesses'?startedPath:'');setError('');
  }catch(e){if(version!==epoch.current||abort.signal.aborted)return;
   if(actor.current&&(e instanceof ApiError&&(e.status===401||e.status===403)||Date.now()-verifiedAt.current>120000)){clear();feeds.current?.clear();}
   setError(e instanceof Error?e.message:'Unable to refresh data');
  }finally{if(version===epoch.current&&controllers.current.get(domain)===abort){requests.current.delete(domain);controllers.current.delete(domain);if(domain==='core')setHydrated(true);if(dirtyDomains.current.has(domain))scheduleResource(domain);}}})();
  requests.current.set(domain,task);return task;
 },[clear,retainMedia,scheduleResource]);
 const connectRef=useRef<(()=>Promise<void>)|null>(null);
 const reload=useCallback(async()=>{await loadResource('core');if(loaded.current.has('billing'))scheduleResource('billing');},[loadResource,scheduleResource]);
 useEffect(()=>{
  retireLegacyCredentials();if(!isSupabaseConfigured()){setError('Supabase configuration is required.');setHydrated(true);return;}
  const queue=new SyncScheduler(key=>key.startsWith('thread:')?refreshThread(key.slice(7)):loadResource(key as Domain),()=>!document.hidden);scheduler.current=queue;
  queue.schedule('core');
  const activeControllers=controllers.current;
  const client=browserSupabase();let channel:ReturnType<typeof client.channel>|undefined;
  const sync=(force=false)=>{if(document.hidden||!actor.current||!force&&Date.now()-lastFocus.current<15000)return;lastFocus.current=Date.now();queue.schedule('core');queue.schedule('notifications');for(const domain of pageDomains(pathRef.current))queue.schedule(domain);feeds.current?.resume();};
  const onChange=(change:Change)=>{
   feeds.current?.invalidate(change);if(loaded.current.has('stats')&&['profiles','businesses','posts','reports','payments','subscriptions'].includes(change.table))scheduleResource('stats');
   const row=change.new??{},old=change.old??{};
   if(change.table==='messages'){const id=String(row.conversation_id??old.conversation_id??'');if(id&&activeThread.current===id)queue.schedule('thread:'+id);else if(loaded.current.has('chats'))scheduleResource('chats');}
   else if(change.table==='conversation_members'||change.table==='conversations'){if(loaded.current.has('chats'))scheduleResource('chats');}
   else if(change.table==='notifications')queue.schedule('notifications');
   else if(change.table==='blocks'){
    const block=change.eventType==='DELETE'?old:row,other=String(block.blocker_id===actor.current?block.blocked_id:block.blocker_id??'');if(other){if(change.eventType==='DELETE')feeds.current?.allowAuthor(other);else feeds.current?.removeAuthor(other);setState(previous=>({...previous,residents:previous.residents.filter(p=>p.id!==other),posts:previous.posts.filter(p=>p.authorId!==other),businesses:previous.businesses.filter(b=>b.ownerId!==other)}));}
    if(loaded.current.has('chats'))scheduleResource('chats');
   }else if(change.table==='profiles'){if(!row.id||row.id===actor.current)queue.schedule('core');if(loaded.current.has('people'))scheduleResource('people');}
   else if(change.table.startsWith('business')||change.table==='payments'||change.table==='subscriptions'){for(const domain of ['businesses','billing'] as Domain[])if(loaded.current.has(domain))scheduleResource(domain);}
   else if(change.table==='reports'&&loaded.current.has('reports'))scheduleResource('reports');
   else if(['posts','comments','post_interests','post_likes','post_saves'].includes(change.table)){for(const domain of ['posts','joined'] as Domain[])if(loaded.current.has(domain))scheduleResource(domain);}
  };
  let connectedActor='',disposed=false;
  const connect=async()=>{const id=actor.current,version=epoch.current;if(!id||connectedActor===id)return;connectedActor=id;if(channel)await client.removeChannel(channel);await client.realtime.setAuth();if(disposed||version!==epoch.current||actor.current!==id)return;
   channel=client.channel(`szocial-${crypto.randomUUID()}`);for(const table of ['messages','conversations','blocks','notifications','posts','comments','post_interests','reports','conversation_members','profiles','businesses','business_offers','post_likes','post_saves','business_saves','payments','subscriptions'])channel.on('postgres_changes',{event:'*',schema:'public',table},onChange);
   const subscribedChannel=channel;channel.subscribe((status:string)=>{if(disposed||version!==epoch.current||channel!==subscribedChannel)return;const previous=connection.current;connection.current=status;if(status==='SUBSCRIBED'&&previous!=='CONNECTING')sync(true);});
  };closeRealtime.current=()=>{connectedActor='';connection.current='CONNECTING';if(channel){void client.removeChannel(channel);channel=undefined;}};connectRef.current=connect;if(actor.current)void connect();
  const {data:{subscription}}=client.auth.onAuthStateChange((event:string,session:{user:{id:string}}|null)=>{
   if(event==='SIGNED_OUT'){connectedActor='';if(channel){void client.removeChannel(channel);channel=undefined;}clear();feeds.current?.clear();inFlight.current.clear();return;}
   if(session?.user.id&&actor.current&&session.user.id!==actor.current){clear();feeds.current?.clear();}
   if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED')queue.schedule('core');
  });
  const focus=()=>sync(),online=()=>sync(true),visibility=()=>{if(!document.hidden)sync(true);};window.addEventListener('focus',focus);document.addEventListener('visibilitychange',visibility);window.addEventListener('online',online);
  const timer=setInterval(()=>{if(document.hidden||!actor.current)return;if(connection.current!=='SUBSCRIBED'){queue.schedule('notifications');for(const domain of pageDomains(pathRef.current))queue.schedule(domain);feeds.current?.resume();}if(Date.now()-lastReconcile.current>=120000){lastReconcile.current=Date.now();queue.schedule('core');for(const domain of pageDomains(pathRef.current))queue.schedule(domain);feeds.current?.resume();}},30000);
  return()=>{disposed=true;closeRealtime.current?.();closeRealtime.current=null;connectRef.current=null;clearInterval(timer);queue.stop();subscription.unsubscribe();if(channel)void client.removeChannel(channel);activeControllers.forEach(c=>c.abort());window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('online',online);};
 // Refs let one account-scoped subscription dispatch against the current page/state.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[loadResource,clear,scheduleResource]);
 useEffect(()=>{if(!hydrated||!actor.current)return;void connectRef.current?.();for(const domain of ['notifications',...pageDomains(path)] as Domain[])if(!loaded.current.has(domain)||dirtyDomains.current.has(domain)||domain==='businesses'&&scopes.current.get(domain)!==path)void loadResource(domain);},[hydrated,path,state.currentUserId,state.currentBusinessOwnerId,loadResource]);
 useEffect(()=>{if(!hydrated)return;const next=JSON.stringify(state.location),previous=catalogLocation.current;catalogLocation.current=next;if(previous!==null&&next!==previous&&actor.current&&pageDomains(pathRef.current).includes('businesses'))scheduleResource('businesses');},[hydrated,state.location,scheduleResource]);
 const run=useCallback(async(action:string,args:Record<string,unknown>={})=>{
  const key=JSON.stringify([action,args]);if(inFlight.current.has(key))return inFlight.current.get(key)!;const version=epoch.current;
  const task=(async()=>{try{const result=await api<{id:string;success:boolean;message?:AppState['chats'][number]['messages'][number];readAt?:string}>('/api/app',{action,args});if(version!==epoch.current)return null;
   if(action.startsWith('admin_')&&loaded.current.has('stats'))scheduleResource('stats');
   for(const domain of mutationDomains(action))if(domain==='core'||loaded.current.has(domain))scheduleResource(domain);
   if(['interest','accept','reject','comment','like','save_post'].includes(action)){for(const domain of ['posts','joined'] as Domain[])if(loaded.current.has(domain))scheduleResource(domain);}
   if(action==='block'){const other=stateRef.current.chats.find(c=>c.id===args.id)?.participantIds.find(id=>id!==actor.current);if(other){if(args.blocked)feeds.current?.removeAuthor(other);else feeds.current?.allowAuthor(other);}feeds.current?.invalidate({table:'blocks'});}
   if(['create_post','update_post','delete_post','close_post','interest','accept','reject','comment','like','save_post','admin_remove_post'].includes(action))feeds.current?.invalidate({table:'posts',new:args.id?{id:args.id}:{}});
   if(action==='read_notifications'){scheduler.current?.schedule('notifications');setNotifications(previous=>previous.map(n=>({...n,isRead:true})));setUnread(0);}
   if(action==='read_chat')setState(previous=>({...previous,chats:previous.chats.map(c=>c.id===args.id?{...c,unread:0,readAtByParticipant:{...c.readAtByParticipant,[actor.current??'']:result.readAt??new Date().toISOString()}}:c)}));
   return result;
  }catch(e){if(version!==epoch.current)return null;if(e instanceof ApiError&&(e.status===401||e.status===403)){clear();feeds.current?.clear();}notify({title:'Changes were not saved',description:e instanceof Error?e.message:'Try again.',variant:'warning'});return null;}finally{if(version===epoch.current)inFlight.current.delete(key);}})();inFlight.current.set(key,task);return task;
 },[notify,scheduleResource,clear]);
 const currentUser=state.residents.find(r=>r.id===(state.currentUserId??state.currentBusinessOwnerId))??visitor;
 const currentBusinessOwner=state.businessOwners.find(o=>o.id===state.currentBusinessOwnerId)??null;
 const currentBusiness=state.businesses.find(b=>b.id===currentBusinessOwner?.businessId)??null;
 const businessId=()=>{if(!currentBusiness)throw new Error('No authorized business');return currentBusiness.id;};
 const auth=async(action:string,body:unknown)=>{
  try{await api('/api/auth/'+action,body);if(action==='logout'){clear();feeds.current?.clear();}else await reload();return true;}
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
   if(result.outcome==='authenticated'){clear();feeds.current?.clear();}
   acceptedSignup.current.set(key,result);setSignupDraft(draft);
   if(result.outcome==='authenticated')await reload();
   return result;
  }catch(error){const outcome=error instanceof ApiError&&(error.status===429||error.outcome==='rate_limited')?'rate_limited':error instanceof ApiError&&error.outcome==='rejected'?'rejected':'uncertain';return {outcome,message:outcome==='uncertain'?'We could not confirm the result. Check your inbox or try signing in before submitting another signup.':error instanceof Error?error.message:'Please try again later.',retryAfter:error instanceof ApiError?error.retryAfter:undefined};}
  finally{signupLock.current=false;}
 };
 const signupResident=async(input:ResidentSignupInput)=>signup(input.email,input.password,input.name,false,{name:input.name,email:input.email,location:input.location,profilePhoto:input.profilePhoto,mobile:input.mobile,age:input.age,gender:input.gender});
 const signupBusiness=async(input:BusinessSignupInput)=>signup(input.email,input.password,input.ownerName,true,{name:input.ownerName,email:input.email,location:input.location,businessName:input.businessName,address:input.address,category:input.category});
 const login=async(email:string,password:string,business=false)=>{try{const result=await api<{next:string}>('/api/auth/login',{email,password,business});clear();feeds.current?.clear();await reload();return result.next;}catch(error){notify({title:'Authentication failed',description:error instanceof Error?error.message:'Please try again.',variant:'warning'});return null;}};
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
  if(JSON.stringify(normalized)===JSON.stringify(stateRef.current.location))return true;
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
 const messageKeys=useRef(new Map<string,string>()),threadRequests=useRef(new Map<string,Promise<void>>());
 const refreshThread=async(id:string,before?:{at:string;id:string})=>{
  if(threadRequests.current.has(id))return threadRequests.current.get(id)!;const version=epoch.current;
  const task=(async()=>{try{const query=new URLSearchParams({id,...(before?{before:before.at,beforeId:before.id}:{})});const page=await api<{messages:AppState['chats'][number]['messages'];hasMore:boolean;unreadCount?:number;readAt?:string}>('/api/messages?'+query);
   if(version!==epoch.current)return;setState(previous=>({...previous,chats:previous.chats.map(c=>c.id===id?{...c,lastMessageAt:before?c.lastMessageAt:page.messages.at(-1)?.createdAt??c.lastMessageAt,unread:page.unreadCount??c.unread,readAtByParticipant:page.readAt?{...c.readAtByParticipant,[actor.current??'']:page.readAt}:c.readAtByParticipant,messages:mergeRows(before?[]:c.messages,page.messages).concat(before?c.messages:[]).filter((m,index,all)=>all.findIndex(other=>other.id===m.id)===index&&(!m.delivery||!page.messages.some(server=>server.clientId===m.clientId))).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)),historyLoaded:true,historyHasMore:before?page.hasMore:c.historyLoaded?c.historyHasMore:page.hasMore}:c)}));
  }catch(e){if(version!==epoch.current)return;if(e instanceof ApiError&&(e.status===403||e.status===401))setState(previous=>({...previous,chats:previous.chats.filter(c=>c.id!==id)}));else notify({title:'History unavailable',description:e instanceof Error?e.message:'Retry',variant:'warning'});}
  finally{if(version===epoch.current)threadRequests.current.delete(id);}})();threadRequests.current.set(id,task);return task;
 };
 const sendChatMessage=async(id:string,input:string|SendChatMessageInput)=>{
  const version=epoch.current,message=typeof input==='string'?{text:input}:input;if(!message.text.trim())return false;
  const key=JSON.stringify([currentUser.id,id,message]),clientId=messageKeys.current.get(key)??crypto.randomUUID();messageKeys.current.set(key,clientId);
  setState(previous=>({...previous,chats:previous.chats.map(c=>c.id===id?{...c,messages:mergeRows(c.messages,[{...message,id:'pending-'+clientId,clientId,delivery:'pending' as const,senderId:currentUser.id,senderType:currentBusinessOwner?'business' as const:'resident' as const,createdAt:new Date().toISOString()}])}:c)}));
  const result=await run('message',{...message,id,clientId});
  if(version!==epoch.current)return false;
  if(result){messageKeys.current.delete(key);setState(previous=>({...previous,chats:previous.chats.map(c=>c.id===id?{...c,lastMessageAt:result.message?.createdAt??c.lastMessageAt,messages:mergeRows(c.messages.filter(m=>m.id!=='pending-'+clientId),result.message?[result.message]:[])}:c)}));if(!result.message)await refreshThread(id);return true;}
  setState(previous=>({...previous,chats:previous.chats.map(c=>c.id===id?{...c,messages:c.messages.map(m=>m.clientId===clientId?{...m,delivery:'failed' as const}:m)}:c)}));return false;
 };
 const loadOlderMessages=async(id:string)=>{const first=stateRef.current.chats.find(c=>c.id===id)?.messages[0];if(first)await refreshThread(id,{at:first.createdAt,id:first.id});};
 const ensureChatHistory=async(id:string)=>{const chat=stateRef.current.chats.find(c=>c.id===id);if(chat&&!chat.historyLoaded)await refreshThread(id);};
 const blockChat=async(id:string)=>{const chat=state.chats.find(c=>c.id===id);return Boolean(await run('block',{id,blocked:!(chat?.blockedByIds??[chat?.blockedById]).includes(currentUser.id)}));};
 const markChatRead=useCallback(async(id:string)=>{const chat=state.chats.find(c=>c.id===id);const actor=state.currentBusinessOwnerId??state.currentUserId;if(!chat||!actor)return;const read=chat.readAtByParticipant?.[actor];if(read&&read>=(chat.lastMessageAt??''))return;await run('read_chat',{id});},[run,state.chats,state.currentUserId,state.currentBusinessOwnerId]);
 const submitReport=async(itemType:'Post'|'User'|'Business'|'Chat',id:string,itemLabel:string,reason:ReportReason)=>Boolean(await run('report',{id,itemType,itemLabel,reason}));
 const residentNotifications=state.currentBusinessOwnerId?[]:notifications,businessNotifications=state.currentBusinessOwnerId?notifications:[];
 return {state,stats,hydrated,error,revision,roles,onboardingComplete,signupDraft,pages,loadMoreResource:(domain:Domain)=>loadResource(domain,true),setActiveThread,ensureChatHistory,feeds:feeds.current,run,reload,currentUser,currentBusinessOwner,currentBusiness,locationLabel:formatUserLocation(state.location),residentNotifications,businessNotifications,setBusinessFilters,
  residentUnreadCount:state.currentBusinessOwnerId?0:unread??residentNotifications.filter(n=>!n.isRead).length,businessUnreadCount:state.currentBusinessOwnerId?unread??businessNotifications.filter(n=>!n.isRead).length:0,
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
type FeedRuntime={actorId:string;hydrated:boolean;location:AppState['location'];residents:ResidentUser[];feeds:FeedCache;run:ReturnType<typeof useStoreValue>['run']};
const FeedContext=createContext<FeedRuntime|null>(null);
export function AppStoreProvider({children}:{children:ReactNode}){
 const value=useStoreValue(),actorId=value.state.currentUserId??value.state.currentBusinessOwnerId??'';
 const runtime=useMemo(()=>({actorId,hydrated:value.hydrated,location:value.state.location,residents:value.state.residents,feeds:value.feeds!,run:value.run}),[actorId,value.hydrated,value.state.location,value.state.residents,value.feeds,value.run]);
 return <StoreContext.Provider value={value}><FeedContext.Provider value={runtime}>{children}</FeedContext.Provider></StoreContext.Provider>;
}
export function useFeedRuntime(){const value=useContext(FeedContext);if(!value)throw new Error('AppStoreProvider is required');return value;}
export function useAppStore(){const value=useContext(StoreContext);if(!value)throw new Error('AppStoreProvider is required');return value;}
