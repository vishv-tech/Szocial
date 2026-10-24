"use client";
import {useEffect,useState} from 'react';
import {useAppStore} from '@/components/AppStoreProvider';
import type {LocalPost} from '@/types';
import type {FeedSort} from '@/lib/feed';
export function useServerFeed(query:string,sort:FeedSort,category:string,type?:string,status='Active'){
 const {state,revision,hydrated}=useAppStore();const [posts,setPosts]=useState<LocalPost[]>([]),[offset,setOffset]=useState(0),[hasMore,setHasMore]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const key=JSON.stringify([query.trim(),sort,category,type,status,state.location.latitude,state.location.longitude,state.location.area,state.location.city]);
 useEffect(()=>{setOffset(0);setPosts([]);},[key,revision]);
 useEffect(()=>{
  if(!hydrated)return;const abort=new AbortController();setLoading(true);setError('');
  const timer=setTimeout(async()=>{try{
   const [q,s,c,t,st,lat,lng,area,city]=JSON.parse(key);
   const params=new URLSearchParams({q,sort:s,category:c,type:t??'',status:st,area:area??'',city:city??'',offset:String(offset)});if(lat!=null&&lng!=null){params.set('lat',String(lat));params.set('lng',String(lng));}
   const response=await fetch('/api/feed?'+params,{signal:abort.signal,cache:'no-store'}),result=await response.json();if(!response.ok)throw new Error(result.error??'Could not load posts');
   if(!abort.signal.aborted){setPosts(current=>offset===0?result.posts:[...new Map([...current,...result.posts].map((p:LocalPost)=>[p.id,p])).values()]);setHasMore(result.hasMore);}
  }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Could not load posts');}finally{if(!abort.signal.aborted)setLoading(false);}},200);
  return()=>{clearTimeout(timer);abort.abort();};
 },[key,offset,revision,hydrated]);
 return {posts,loading,error,hasMore,loadMore:()=>{if(!loading)setOffset(n=>n+20);}};
}
