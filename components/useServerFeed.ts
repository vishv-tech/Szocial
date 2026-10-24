"use client";
import {usePathname} from 'next/navigation';
import {useCallback,useEffect,useMemo,useSyncExternalStore} from 'react';
import {useFeedRuntime} from '@/components/AppStoreProvider';
import type {FeedSort} from '@/lib/feed';
export function useFeedPreference<T extends string>(name:string,fallback:T){
 const {feeds,actorId}=useFeedRuntime(),key=actorId+':'+name;
 const get=useCallback(()=>feeds.preference(key,fallback) as T,[feeds,key,fallback]);
 const value=useSyncExternalStore(feeds.subscribePreferences,get,()=>fallback);
 const set=useCallback((next:T)=>feeds.setPreference(key,next),[feeds,key]);return [value,set] as const;
}
export function useServerFeed(query:string,sort:FeedSort,category:string,type?:string,status='Active'){
 const {feeds,actorId,hydrated,location}=useFeedRuntime(),pathname=usePathname();
 const key=JSON.stringify([query.trim(),sort,category,type,status,location.latitude,location.longitude,location.area,location.city,actorId]);
 const url=useMemo(()=>{const [q,s,c,t,st,lat,lng,area,city]=JSON.parse(key);const params=new URLSearchParams({q,sort:s,category:c,type:t??'',status:st,area:area??'',city:city??''});if(lat!=null&&lng!=null){params.set('lat',String(lat));params.set('lng',String(lng));}return '/api/feed?'+params;},[key]);
 const subscribe=useCallback((fn:()=>void)=>feeds.subscribe(key,fn),[feeds,key]);const snapshot=useCallback(()=>feeds.get(key),[feeds,key]);
 const view=useSyncExternalStore(subscribe,snapshot,snapshot);
 useEffect(()=>{
  if(!view.loaded)return;let restoring=true,second=0;const position=feeds.position(key);
  // Next's route scroll runs during the same commit; restore after it, and ignore
  // navigation-generated scroll events from the page that is being left.
  const frame=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{if(position!==undefined&&window.location.pathname===pathname)window.scrollTo({top:position,behavior:'instant'});restoring=false;});});
  const save=()=>{if(!restoring&&window.location.pathname===pathname)feeds.position(key,window.scrollY);};window.addEventListener('scroll',save,{passive:true});return()=>{cancelAnimationFrame(frame);cancelAnimationFrame(second);window.removeEventListener('scroll',save);};
 },[feeds,key,view.loaded,pathname]);
 useEffect(()=>{if(!hydrated||!actorId)return;const timer=setTimeout(()=>void feeds.load(key,url),feeds.get(key).loaded?0:150);return()=>clearTimeout(timer);},[feeds,key,url,hydrated,actorId]); // cached pages stay visible while revalidating
 return {posts:actorId?view.posts:[],loading:!view.loaded&&(!hydrated||Boolean(actorId)),refreshing:view.refreshing,error:view.error,hasMore:view.hasMore,loadMore:()=>feeds.load(key,url,true),retry:()=>feeds.load(key,url)};
}
