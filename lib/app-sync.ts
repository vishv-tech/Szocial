import type {AppState} from '@/types';
import {sameData} from '@/lib/feed-cache';
export type Domain='stats'|'core'|'notifications'|'chats'|'businesses'|'posts'|'joined'|'billing'|'people'|'reports';
export function pageDomains(path:string):Domain[]{
 if(path.startsWith('/admin'))return path.includes('/users')?['people']:path.includes('/posts')?['posts']:path.includes('/reports')?['reports']:path.includes('/businesses')?['businesses','billing']:[ 'stats','people','businesses','posts','reports','billing'];
 if(path.startsWith('/business/'))return path.includes('/messages')?['chats']:path.includes('/pricing')?['billing']:['businesses','billing'];
 if(path==='/chats')return ['chats'];if(path==='/profile')return ['posts','joined'];if(path==='/my-posts')return ['posts'];if(path.startsWith('/businesses'))return ['businesses'];if(path==='/home')return ['businesses'];if(path==='/explore')return ['people'];return [];
}
export function mergeRows<T extends {id:string}>(old:T[],next:T[],replace=false){const previous=new Map(old.map(row=>[row.id,row]));const incoming=next.map(row=>sameData(previous.get(row.id),row)?previous.get(row.id)!:row);return replace?incoming:[...new Map([...old,...incoming].map(row=>[row.id,row])).values()];}
export function mergePatch(previous:AppState,patch:Partial<AppState>,domain:Domain,append=false,allPosts=false):AppState{
 const next={...previous,...patch};
 for(const key of ['residents','businesses','posts','chats','reports','paymentHistory','paymentPlans','businessOwners'] as const){
  if(!patch[key])continue;
  let incoming=patch[key]!;
  const actor=previous.currentUserId??previous.currentBusinessOwnerId;
  // Public identity patches must never overwrite the owner's private profile.
  if(key==='residents'&&domain!=='core')incoming=(incoming as AppState['residents']).filter(person=>person.id!==actor) as typeof incoming;
  if(key==='businesses')incoming=(incoming as AppState['businesses']).map(business=>{const old=previous.businesses.find(b=>b.id===business.id);if(!old)return business;return {...business,...(!business.detailsLoaded?{offers:old.offers,offerCreatedAt:old.offerCreatedAt,isSaved:old.isSaved,detailsLoaded:old.detailsLoaded}:{}),...(!business.analyticsLoaded?{views:old.views,saves:old.saves,messages:old.messages,analyticsLoaded:old.analyticsLoaded}:{})};}) as typeof incoming;
  if(key==='chats')incoming=(incoming as AppState['chats']).map(chat=>{const old=previous.chats.find(c=>c.id===chat.id);return old?.historyLoaded?{...chat,historyLoaded:true,historyHasMore:old.historyHasMore,messages:mergeRows(old.messages,chat.messages).filter(m=>!m.delivery||!chat.messages.some(server=>server.clientId===m.clientId))}:chat;}) as typeof incoming;
  const primary=domain==='people'&&key==='residents'||domain==='businesses'&&key==='businesses'||(domain==='posts'||domain==='joined')&&key==='posts'||domain==='chats'&&key==='chats'||domain==='billing'&&(key==='paymentHistory'||key==='paymentPlans'||key==='businessOwners')||domain==='core'&&key==='businessOwners'||domain==='reports'&&key==='reports';
  // Joined and own posts share a view; replace only the corresponding ownership slice.
  const retained=key==='businesses'&&domain==='businesses'?previous.businesses.filter(b=>b.ownerId===actor):key==='residents'&&domain==='people'?previous.residents.filter(r=>r.id===(previous.currentUserId??previous.currentBusinessOwnerId)):key==='posts'&&domain==='posts'&&!allPosts?previous.posts.filter(p=>p.authorId!==(previous.currentUserId??previous.currentBusinessOwnerId)):key==='posts'&&domain==='joined'?previous.posts.filter(p=>p.authorId===(previous.currentUserId??previous.currentBusinessOwnerId)):[];
  const merged=mergeRows(previous[key] as {id:string}[],incoming as {id:string}[],primary&&!append);
  (next as unknown as Record<string,unknown>)[key]=(key==='posts'||key==='residents'||key==='businesses')&&primary&&!append?mergeRows(retained as {id:string}[],merged):merged;
 }
 for(const key of Object.keys(next) as (keyof AppState)[])if(sameData(previous[key],next[key]))(next as unknown as Record<string,unknown>)[key]=previous[key];
 return sameData(previous,next)?previous:next;
}
export function mutationDomains(action:string):Domain[]{
 if(action==='read_chat'||action==='read_notifications'||action==='message')return [];
 if(['interest','like','save_post','comment'].includes(action))return [];
 if(action==='profile'||action==='create_business')return ['core'];
 if(action==='start_chat'||action==='block'||action==='accept')return ['chats'];
 if(action.includes('business')||action==='offer'||action==='cancel_subscription')return ['businesses','billing','core'];
 if(action.includes('report')||action==='verification_request')return ['reports'];
 if(action.startsWith('admin_user')||action==='admin_verify_user')return ['people','core'];
 return ['posts'];
}
