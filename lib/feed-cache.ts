import type {LocalPost} from '@/types';
export type FeedPage={posts:LocalPost[];hasMore:boolean};
export type FeedView=FeedPage&{loaded:boolean;loading:boolean;refreshing:boolean;error:string;depth:number};
export type Change={table:string;eventType?:string;new?:Record<string,unknown>;old?:Record<string,unknown>};
const empty:FeedView={posts:[],hasMore:false,loaded:false,loading:false,refreshing:false,error:'',depth:1};
export function sameData(a:unknown,b:unknown){return a===b||JSON.stringify(a)===JSON.stringify(b);}
export function sharePosts(previous:LocalPost[],next:LocalPost[]){const old=new Map(previous.map(p=>[p.id,p]));return next.map(p=>sameData(old.get(p.id),p)?old.get(p.id)!:p);}
export function feedAffected(key:string,view:FeedView,change:Change){
 if(!['posts','comments','post_interests','post_likes','post_saves','blocks','profiles'].includes(change.table))return false;
 if(change.table==='blocks')return true;
 if(change.table==='profiles'){const id=String(change.new?.id??change.old?.id??'');return !id||view.posts.some(p=>p.authorId===id||p.people?.some(person=>person.id===id));}
 const row=change.new??{},old=change.old??{},id=String(row.post_id??old.post_id??row.id??old.id??'');
 if(view.posts.some(p=>p.id===id))return true;
 if(change.table!=='posts'||change.eventType==='DELETE')return false;
 const [query,,category,type,status]=JSON.parse(key);
 if(row.type&&type&&row.type!==type||row.status&&row.status!==status)return false;
 const groups:Record<string,string[]>={Sports:['Cricket','Football','Badminton','Gym'],Movies:['Movie'],Adventure:['Hiking'],Study:['Study','Tutor'],Food:['Cafe','Food','Restaurant']};
 if(category==='Urgent'&&row.data&&typeof row.data==='object'&&(row.data as Record<string,unknown>).urgency!=='Urgent')return false;
 if(category==='Help'&&row.type!=='help'||groups[category]&&row.category&&!groups[category].includes(String(row.category)))return false;
 if(query&&row.title&&row.description){const text=JSON.stringify([row.title,row.description,row.category,row.location]).toLowerCase();if(!text.includes(String(query).toLowerCase()))return false;}
 return true;
}
/** One cache belongs to one provider/account. Never module-global or persisted. */
export class FeedCache{
 private entries=new Map<string,{view:FeedView;listeners:Set<()=>void>;pending?:Promise<void>;dirty:boolean;url:string;controller?:AbortController;timer?:ReturnType<typeof setTimeout>}>();
 private epoch=0;private deniedAuthors=new Set<string>();
 private preferences=new Map<string,string>();private preferenceListeners=new Set<()=>void>();private positions=new Map<string,number>();
 preference(key:string,fallback:string){return this.preferences.get(key)??fallback;}
 setPreference(key:string,value:string){if(this.preferences.get(key)===value)return;this.preferences.set(key,value);this.preferenceListeners.forEach(fn=>fn());}
 subscribePreferences=(fn:()=>void)=>{this.preferenceListeners.add(fn);return()=>{this.preferenceListeners.delete(fn);};};
 position(key:string,value?:number){if(value!==undefined)this.positions.set(key,value);return this.positions.get(key);}
 constructor(private fetchPage:(url:string,signal:AbortSignal)=>Promise<FeedPage>,private unauthorized:()=>void=()=>{}){}
 private entry(key:string,url=''){let item=this.entries.get(key);if(!item){item={view:empty,listeners:new Set(),dirty:false,url};this.entries.set(key,item);if(this.entries.size>32)for(const [old,e] of this.entries){if(this.entries.size<=32)break;if(old!==key&&!e.listeners.size&&!e.pending){clearTimeout(e.timer);this.entries.delete(old);this.positions.delete(old);}}}if(url)item.url=url;return item;}
 get=(key:string)=>this.entry(key).view;
 subscribe=(key:string,listener:()=>void)=>{const e=this.entry(key);e.listeners.add(listener);return()=>e.listeners.delete(listener);};
 private publish(key:string,next:FeedView){const e=this.entry(key);if(sameData(e.view,next))return;e.view=next;e.listeners.forEach(fn=>fn());}
 async load(key:string,url:string,more=false):Promise<void>{
  const e=this.entry(key,url);if(e.pending)return e.pending;
  const controller=new AbortController();e.controller=controller;
  const epoch=this.epoch,depth=e.view.depth+(more?1:0),had=e.view.loaded;
  this.publish(key,{...e.view,loading:!had,refreshing:had,error:''});
  e.pending=(async()=>{try{
   const pages:FeedPage[]=[];for(let page=0;page<depth;page++){const result=await this.fetchPage(url+'&offset='+page*20,controller.signal);pages.push(result);if(!result.hasMore)break;}
   if(epoch!==this.epoch)return;
   const posts=sharePosts(e.view.posts,[...new Map(pages.flatMap(p=>p.posts).filter(p=>!this.deniedAuthors.has(p.authorId)).map(p=>[p.id,p])).values()]);
   this.publish(key,{posts,hasMore:pages.at(-1)?.hasMore??false,loaded:true,loading:false,refreshing:false,error:'',depth:pages.length});
  }catch(error){if(epoch!==this.epoch)return;const status=(error as {status?:number}).status;if(status===401||status===403){this.unauthorized();return;}
   this.publish(key,{...e.view,loading:false,refreshing:false,error:error instanceof Error?error.message:'Refresh failed. Retry.'});
  }finally{e.pending=undefined;if(epoch===this.epoch&&e.dirty){e.dirty=false;this.schedule(key);}}})();return e.pending;
 }
 private schedule(key:string){const e=this.entry(key);if(e.timer)return;e.timer=setTimeout(()=>{e.timer=undefined;if(e.listeners.size&&typeof document!=='undefined'&&!document.hidden){if(e.pending)e.dirty=true;else void this.load(key,e.url);}else e.dirty=true;},200);}
 invalidate(change?:Change){for(const [key,e] of this.entries)if(!change||feedAffected(key,e.view,change)){e.dirty=true;if(e.listeners.size&&!e.pending){e.dirty=false;this.schedule(key);}}}
 allowAuthor(id:string){this.deniedAuthors.delete(id);}
 removeAuthor(id:string){this.deniedAuthors.add(id);for(const [key,e] of this.entries)this.publish(key,{...e.view,posts:e.view.posts.filter(p=>p.authorId!==id)});}
 resume(){for(const [key,e] of this.entries)if(e.listeners.size&&!e.pending){e.dirty=false;this.schedule(key);}}
 clear(){this.epoch++;this.deniedAuthors.clear();this.preferences.clear();this.positions.clear();this.preferenceListeners.forEach(fn=>fn());for(const [key,e] of this.entries){clearTimeout(e.timer);e.controller?.abort();e.dirty=false;e.pending=undefined;this.publish(key,empty);}this.entries.clear();}
}
