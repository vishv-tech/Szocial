/* eslint-disable @typescript-eslint/no-require-imports */
require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {FeedCache,feedAffected}=require('../lib/feed-cache.ts');
const {SyncScheduler}=require('../lib/sync-scheduler.ts');
const {mergePatch}=require('../lib/app-sync.ts');
const {initialAppState}=require('../lib/mock-data.ts');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
const key=JSON.stringify(['','nearby','All',null,'Active',19,72,'Wadala','Mumbai','a']);
const post=id=>({id,authorId:'b',title:id,type:'fun',comments:[],images:[],createdAt:'2026-10-24T12:00:00Z'});
const page=(...ids)=>({posts:ids.map(post),hasMore:false});
test('feed coalesces duplicate loads and keeps cached cards visible during background revalidation',async()=>{
 let calls=0,next=deferred();const cache=new FeedCache(()=>{calls++;return next.promise;});
 const first=cache.load(key,'/feed?q=');const duplicate=cache.load(key,'/feed?q=');assert.equal(calls,1);assert.equal(cache.get(key).loading,true);
 next.resolve(page('one'));await Promise.all([first,duplicate]);const old=cache.get(key).posts[0];next=deferred();const refresh=cache.load(key,'/feed?q=');assert.equal(cache.get(key).loading,false);assert.equal(cache.get(key).refreshing,true);assert.equal(cache.get(key).posts[0],old);
 next.resolve(page('one'));await refresh;assert.equal(calls,2);assert.equal(cache.get(key).posts[0],old);cache.clear();
});
test('temporary refresh failures retain data; denied access clears all account data',async()=>{
 let fail=false,denied=false,cache;cache=new FeedCache(async()=>{if(fail)throw Object.assign(new Error('Service unavailable'),{status:denied?401:503});return page('private');},()=>cache.clear());
 await cache.load(key,'/feed?q=');fail=true;await cache.load(key,'/feed?q=');assert.equal(cache.get(key).posts[0].id,'private');assert.match(cache.get(key).error,/unavailable/);denied=true;await cache.load(key,'/feed?q=');assert.deepEqual(cache.get(key).posts,[]);cache.clear();
});
test('loaded pagination survives insertion, deletion and a whole-window refresh without duplicates',async()=>{
 let rows=Array.from({length:45},(_,n)=>post(String(n)));const cache=new FeedCache(async url=>{const offset=Number(new URL(url,'http://test').searchParams.get('offset'));return {posts:rows.slice(offset,offset+20),hasMore:rows.length>offset+20};});
 await cache.load(key,'/feed?q=');await cache.load(key,'/feed?q=',true);assert.equal(cache.get(key).posts.length,40);
 rows=[post('new'),...rows.filter(p=>p.id!=='3')];await cache.load(key,'/feed?q=');const view=cache.get(key);assert.equal(view.depth,2);assert.equal(view.posts[0].id,'new');assert.equal(view.posts.length,40);assert.equal(new Set(view.posts.map(p=>p.id)).size,40);assert.equal(view.posts.some(p=>p.id==='3'),false);cache.clear();
});
test('logout aborts pending requests, clears preferences and ignores late responses from the previous account',async()=>{
 const old=deferred();let signal;const cache=new FeedCache((url,s)=>{signal=s;return old.promise;});cache.setPreference('a:search','private');cache.position(key,540);const pending=cache.load(key,'/feed?q=');cache.clear();assert.equal(signal.aborted,true);assert.equal(cache.preference('a:search',''), '');assert.equal(cache.position(key),undefined);
 old.resolve(page('private'));await pending;assert.deepEqual(cache.get(key).posts,[]);const other=new FeedCache(async()=>page('other'));await other.load(key,'/feed?q=');assert.deepEqual(cache.get(key).posts,[]);assert.equal(other.get(key).posts[0].id,'other');other.clear();cache.clear();
});
test('realtime matching respects filters but always rechecks a changed visible post',()=>{
 const filtered=JSON.stringify(['game','nearby','Sports','fun','Active']),view={posts:[post('visible')]};
 assert.equal(feedAffected(filtered,view,{table:'notifications',new:{}}),false);
 assert.equal(feedAffected(filtered,view,{table:'posts',eventType:'INSERT',new:{id:'other',type:'help',title:'cricket',description:'Help'}}),false);
 assert.equal(feedAffected(filtered,view,{table:'posts',new:{type:'fun',category:'Cricket',title:'Football',description:'Meetup'}}),false);
 assert.equal(feedAffected(filtered,view,{table:'posts',new:{type:'fun',category:'Cricket',title:'Cricket game',description:'Meetup'}}),true);
 assert.equal(feedAffected(filtered,view,{table:'posts',eventType:'DELETE',old:{id:'visible'}}),true);
 assert.equal(feedAffected(filtered,view,{table:'posts',new:{id:'visible',status:'Closed'}}),true);
 assert.equal(feedAffected(filtered,view,{table:'post_interests',new:{post_id:'other'}}),false);
});
test('realtime bursts coalesce, pause while hidden and refresh once on resume',async()=>{
 const original=global.document;global.document={hidden:false};let calls=0;const cache=new FeedCache(async()=>{calls++;return page('one');}),off=cache.subscribe(key,()=>{});
 try{await cache.load(key,'/feed?q=');for(let i=0;i<10;i++)cache.invalidate({table:'posts',new:{id:'one'}});await delay(250);assert.equal(calls,2);
 global.document.hidden=true;cache.invalidate();await delay(250);assert.equal(calls,2);global.document.hidden=false;cache.resume();await delay(250);assert.equal(calls,3);
 }finally{off();cache.clear();global.document=original;}
});
test('changes during a slow request get one trailing authorized refresh',async()=>{
 const original=global.document;global.document={hidden:false};const slow=deferred();let calls=0;const cache=new FeedCache(()=>++calls===1?slow.promise:Promise.resolve(page('fresh'))),off=cache.subscribe(key,()=>{});
 try{const pending=cache.load(key,'/feed?q=');for(let n=0;n<8;n++)cache.invalidate();slow.resolve(page('old'));await pending;await delay(250);assert.equal(calls,2);assert.equal(cache.get(key).posts[0].id,'fresh');}finally{off();cache.clear();global.document=original;}
});
test('blocked authors disappear immediately from every cached feed',async()=>{
 const cache=new FeedCache(async()=>({posts:[post('blocked'),{...post('other'),authorId:'c'}],hasMore:false}));await cache.load(key,'/feed?q=');cache.removeAuthor('b');assert.deepEqual(cache.get(key).posts.map(p=>p.id),['other']);cache.clear();
});
test('resource scheduler prevents overlap and coalesces one trailing event burst',async()=>{
 const slow=deferred();let calls=0,active=0,peak=0;const scheduler=new SyncScheduler(async()=>{calls++;peak=Math.max(peak,++active);if(calls===1)await slow.promise;active--;},()=>true,5);
 try{scheduler.schedule('chats');await delay(15);for(let n=0;n<10;n++)scheduler.schedule('chats');await delay(15);assert.equal(calls,1);slow.resolve();await delay(25);assert.equal(calls,2);assert.equal(peak,1);}finally{scheduler.stop();}
});
test('resource scheduler retains hidden updates and does not fetch after cleanup',async()=>{
 let visible=false,calls=0;const scheduler=new SyncScheduler(async()=>{calls++;},()=>visible,5);scheduler.schedule('notifications');await delay(15);assert.equal(calls,0);visible=true;await scheduler.flush();assert.equal(calls,1);scheduler.stop();scheduler.schedule('core');await delay(15);assert.equal(calls,1);
});
test('targeted patches preserve unrelated post identities and current private profile',()=>{
 const state=structuredClone(initialAppState);state.currentUserId=state.residents[0].id;
 const next=mergePatch(state,{residents:state.residents.slice(1)},'people');assert.ok(next.residents.some(p=>p.id===state.currentUserId));assert.equal(next.posts,state.posts);assert.equal(next.chats,state.chats);
 assert.equal(mergePatch(state,{posts:structuredClone(state.posts)},'core'),state);
});
test('chat summaries retain expanded history and reconcile a confirmed optimistic message once',()=>{
 const state=structuredClone(initialAppState),chat=state.chats[0];chat.historyLoaded=true;chat.historyHasMore=true;chat.messages=[{id:'old',text:'history',createdAt:'2026-01-01'},{id:'pending-key',clientId:'key',delivery:'pending',text:'new',createdAt:'2026-01-02'}];
 const next=mergePatch(state,{chats:[{...chat,historyLoaded:false,messages:[{id:'server',clientId:'key',text:'new',createdAt:'2026-01-02'}]}]},'chats');assert.deepEqual(next.chats[0].messages.map(m=>m.id),['old','server']);assert.equal(next.chats[0].historyHasMore,true);
});
test('administrator post refresh removes deleted foreign posts instead of retaining stale ownership slices',()=>{
 const state=structuredClone(initialAppState),next=mergePatch(state,{posts:[]},'posts',false,true);assert.deepEqual(next.posts,[]);
});
test('a slow pre-block response cannot restore an author whose access was revoked',async()=>{
 let slow;const cache=new FeedCache(()=>slow?slow.promise:Promise.resolve(page('private')));await cache.load(key,'/feed?q=');slow=deferred();const pending=cache.load(key,'/feed?q=');cache.removeAuthor('b');slow.resolve(page('private'));await pending;assert.deepEqual(cache.get(key).posts,[]);cache.allowAuthor('b');slow=undefined;await cache.load(key,'/feed?q=');assert.equal(cache.get(key).posts[0].id,'private');cache.clear();
});
test('inactive search caches are bounded while an active paginated feed remains available',async()=>{
 const cache=new FeedCache(async()=>page('kept')),off=cache.subscribe(key,()=>{});await cache.load(key,'/feed?q=');for(let n=0;n<60;n++){const other=JSON.stringify(['query-'+n,'newest','All',null,'Active']);await cache.load(other,'/feed?q=');}assert.equal(cache.get(key).posts[0].id,'kept');const old=JSON.stringify(['query-0','newest','All',null,'Active']);assert.equal(cache.get(old).loaded,false);off();cache.clear();
});
test('public profile pages and conversation identities cannot overwrite the account private profile',()=>{
 const state=structuredClone(initialAppState);state.currentUserId=state.residents[0].id;const own=state.residents[0];own.age=42;own.mobile='private';own.privacy.allowDirectMessages=false;
 for(const domain of ['people','chats','notifications']){const next=mergePatch(state,{residents:[{...own,age:undefined,mobile:undefined,privacy:{showAge:false,showExactArea:false,allowDirectMessages:true}}]},domain);assert.equal(next.residents.find(p=>p.id===own.id),own);}
});
test('billing and core patches preserve separately loaded business offers and analytics',()=>{
 const state=structuredClone(initialAppState),business=state.businesses[0];business.offers=['Current offer'];business.views=321;business.detailsLoaded=true;business.analyticsLoaded=true;
 const next=mergePatch(state,{businesses:[{...business,offers:[],views:0,detailsLoaded:false,analyticsLoaded:false}]},'billing');assert.deepEqual(next.businesses.find(b=>b.id===business.id).offers,['Current offer']);assert.equal(next.businesses.find(b=>b.id===business.id).views,321);
});
test('account reset discards queued resources belonging to the previous account',async()=>{
 const calls=[],scheduler=new SyncScheduler(async key=>{calls.push(key);},()=>true,5);scheduler.schedule('reports');scheduler.schedule('thread:old');scheduler.reset();scheduler.schedule('core');await delay(20);assert.deepEqual(calls,['core']);scheduler.stop();
});
test('business directory ranks and filters before pagination, including matches beyond the first page',()=>{
 const {businessCatalog}=require('../lib/business-catalog.ts'),location={latitude:19,longitude:72};const rows=Array.from({length:45},(_,n)=>({id:String(n),name:'Cafe '+n,category:n===44?'Gym':'Cafe',about:'Local',created_at:'2026-10-24T12:00:00Z',location:{latitude:20,longitude:72}}));rows[44].location=location;
 assert.equal(businessCatalog(rows,location)[0].id,'44');assert.deepEqual(businessCatalog(rows,location,'','Gym').map(b=>b.id),['44']);assert.deepEqual(businessCatalog(rows,location,'Cafe 44').map(b=>b.id),['44']);
});
