/* eslint-disable @typescript-eslint/no-require-imports */
require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const original=Module._load;
const owner='11111111-1111-4111-8111-111111111111',peer='22222222-2222-4222-8222-222222222222',chatId='33333333-3333-4333-8333-333333333333';
let client,actor=owner;class AccessError extends Error{constructor(message,status){super(message);this.status=status;}}
Module._load=function(name,...rest){if(name==='server-only')return {};if(name==='@/lib/supabase/server')return {AccessError,authenticatedClient:async()=>({client,user:{id:actor,email:'private@example.invalid'}})};return original.call(this,name,...rest);};
const {appSnapshot,mapPosts}=require('../lib/server-data.ts'),{adminStatistics}=require('../lib/admin-stats.ts'),messagesRoute=require('../app/api/messages/route.ts'),feedRoute=require('../app/api/feed/route.ts');Module._load=original;
function fixture(tables,failTable){
 const calls=[],signed=[];
 const from=table=>{const call={table,filters:[],columns:'',options:{},range:undefined};calls.push(call);let single=false;const q={
 select(columns,options){call.columns=columns;call.options=options??{};return q;},eq(column,value){call.filters.push([column,'eq',value]);return q;},neq(column,value){call.filters.push([column,'neq',value]);return q;},in(column,value){call.filters.push([column,'in',value]);return q;},gt(column,value){call.filters.push([column,'gt',value]);return q;},or(value){call.or=value;return q;},order(){return q;},range(start,end){call.range=[start,end];return q;},limit(n,options){if(!options)call.limit=n;return q;},single(){single=true;return q;},maybeSingle(){single="maybe";return q;},then(resolve,reject){
 if(failTable===table)return Promise.resolve({data:null,error:{code:'ETIMEDOUT',message:'Temporary outage'},count:null}).then(resolve,reject);
 let rows=structuredClone(tables[table]??[]);for(const [key,op,value] of call.filters)rows=rows.filter(row=>op==='eq'?row[key]===value:op==='neq'?row[key]!==value:op==='in'?value.includes(row[key]):row[key]>value);
 if(call.columns.includes(':data->'))rows=rows.map(row=>Object.fromEntries(call.columns.split(',').map(key=>{if(key.includes(':data->')){const [alias,field]=key.split(':data->');return [alias,row.data?.[field.replace(/^>/,'')]];}return [key,row[key]];})));
 const count=rows.length;if(call.range)rows=rows.slice(call.range[0],call.range[1]+1);if(call.limit)rows=rows.slice(0,call.limit);
 return Promise.resolve({data:call.options.head?null:single?rows[0]??null:rows,error:single===true&&!rows.length?{code:'PGRST116'}:null,count}).then(resolve,reject);
 }};return q;};
 return {calls,signed,from,rpc:async()=>({data:tables.posts??[],error:null}),storage:{from:bucket=>({createSignedUrls:async paths=>{signed.push({bucket,paths});return {data:paths.map(path=>({path,signedUrl:'https://storage.example.invalid/'+path})),error:null};}})}};
}
const profile=(id,name,avatar_path)=>({id,full_name:name,avatar_path,account_status:'Active',area:'Wadala',city:'Mumbai',verified:false,created_at:'2026-10-24T12:00:00Z'});
const post=(id,author)=>({id,author_id:author,title:'Cricket',description:'Meetup',type:'fun',status:'Active',visibility:'Public',category:'Cricket',data:{images:[]},location:{area:'Wadala',city:'Mumbai'},created_at:'2026-10-24T12:00:00Z'});
test('core snapshot reads only account bootstrap records and signs only its own referenced avatar',async()=>{
 client=fixture({profiles:[profile(owner,'Owner','own/avatar.webp'),profile(peer,'Other','other/avatar.webp')],profile_private:[{user_id:owner,onboarding_complete:true,location:{area:'Wadala'}}],account_roles:[{user_id:owner,role:'resident'}],media:[{bucket:'szocial-avatars',path:'own/avatar.webp'},{bucket:'szocial-avatars',path:'other/avatar.webp'}],messages:[{id:'private-unrelated'}],posts:[post('unrelated',peer)]});
 const result=await appSnapshot(client,{id:owner,email:'private@example.invalid'});assert.equal(result.actorId,owner);assert.equal(result.state.residents.length,1);assert.equal(result.state.residents[0].email,'private@example.invalid');assert.equal(result.state.posts,undefined);assert.equal(result.state.chats,undefined);assert.equal(result.state.paymentHistory,undefined);assert.equal(result.onboardingComplete,true);
 assert.deepEqual(client.calls.map(c=>c.table).sort(),['profiles','profile_private','account_roles','businesses','media'].sort());assert.deepEqual(client.signed,[{bucket:'szocial-avatars',paths:['own/avatar.webp']}]);
});
test('feed mapping batches related rows and excludes foreign post interactions and media',async()=>{
 client=fixture({profiles:[profile(owner,'Owner'),profile(peer,'Neighbour')],comments:[{id:'comment',post_id:'one',author_id:owner,body:'Hello'},{id:'foreign',post_id:'private',author_id:'foreign',body:'Private'}],post_interests:[{post_id:'private',user_id:'foreign'},{post_id:'one',user_id:owner,status:'pending'}],media:[{bucket:'szocial-posts',path:'unrelated.webp'}]});
 const result=await mapPosts(client,[post('one',peer),post('two',peer)]);assert.equal(result[0].comments.length,1);assert.deepEqual(result[0].interestedUserIds,[owner]);assert.equal(result[0].author.name,'Neighbour');assert.equal(result[0].author.email,undefined);assert.equal(client.calls.filter(c=>c.table==='profiles').length,1);assert.deepEqual(client.signed,[]);
 for(const call of client.calls.filter(c=>['comments','post_interests','post_saves','post_likes'].includes(c.table)))assert.deepEqual(call.filters.find(f=>f[0]==='post_id')[2],['one','two']);
});
test('feed API sends unique public identities once without private profile information',async()=>{
 client=fixture({posts:[post('one',peer),post('two',peer)],profiles:[profile(peer,'Neighbour')]});const response=await feedRoute.GET(new Request('https://app.test/api/feed'));assert.equal(response.status,200);const data=await response.json();assert.equal(data.posts.length,2);assert.equal(data.people.length,1);assert.equal(data.posts[0].author,undefined);assert.equal(data.people[0].email,undefined);assert.match(response.headers.get('cache-control'),/private/);assert.match(response.headers.get('server-timing'),/total/);
});
test('conversation summaries include one latest message and no downloaded historical message bodies',async()=>{
 const now='2026-10-24T12:00:00Z',latest={id:'latest',sender_id:peer,body:'Recent',kind:'text',data:{},created_at:now};client=fixture({conversations:[{id:chatId,created_at:now,updated_at:now,conversation_members:[{user_id:owner,read_at:now,profiles:profile(owner,'Owner')},{user_id:peer,read_at:now,profiles:profile(peer,'Neighbour')}],last_message:[latest]}],messages:[{conversation_id:chatId,sender_id:peer,kind:'text'},{conversation_id:chatId,sender_id:peer,kind:'system'}]});
 const result=await appSnapshot(client,{id:owner},'chats');assert.equal(result.state.chats[0].messages.length,1);assert.equal(result.state.chats[0].historyLoaded,false);assert.equal(result.state.chats[0].unread,1);assert.equal(client.calls.filter(c=>c.table==='conversations').length,1);assert.ok(client.calls.find(c=>c.table==='conversations').columns.includes('last_message:messages'));assert.ok(client.calls.filter(c=>c.table==='messages').every(c=>c.columns==='conversation_id'));
});
test('temporary membership-query failures keep a retryable status; true nonmembership is denied',async()=>{
 client=fixture({},'conversation_members');let response=await messagesRoute.GET(new Request('https://app.test/api/messages?id='+chatId));assert.equal(response.status,503);
 client=fixture({});response=await messagesRoute.GET(new Request('https://app.test/api/messages?id='+chatId));assert.equal(response.status,403);assert.equal(client.calls.some(c=>c.table==='messages'),false);
});
test('platform statistics require an actual admin role before any aggregate read',async()=>{
 client=fixture({account_roles:[]});await assert.rejects(adminStatistics(client,owner),error=>error.status===403);assert.deepEqual(client.calls.map(c=>c.table),['account_roles']);
});
test('administrator statistics cover more than one collection page and return minimal aggregate inputs',async()=>{
 const profiles=Array.from({length:520},(_,i)=>profile(String(i),'Resident'));client=fixture({account_roles:[{user_id:owner,role:'admin'}],profiles,payments:Array.from({length:520},(_,i)=>({id:String(i),status:'paid',amount_paise:100,refunded_paise:0})),reports:[{id:'report',item_type:'Post',item_id:'one',reported_user_id:peer,status:'Open',created_at:'2026-10-24T12:00:00Z'}],posts:[post('one',peer)]});
 const stats=await adminStatistics(client,owner);assert.equal(stats.residents,520);assert.equal(stats.revenue,520);assert.equal(stats.reportedPosts,1);assert.equal(stats.reportedUsers,1);assert.equal(stats.openReports,1);assert.deepEqual(stats.locationActivity,[['Wadala, Mumbai',1]]);assert.equal(client.calls.filter(c=>c.table==='payments').length,2);assert.ok(client.calls.filter(c=>c.table==='payments').every(c=>!c.columns.includes('*')));
});
test('business API pagination preserves global nearby ranking and searches beyond its first page',async()=>{
 const businesses=Array.from({length:45},(_,i)=>({id:String(i),owner_id:peer,name:'Business '+i,category:i===44?'Gym':'Cafe',status:'Live',created_at:'2026-10-24T12:00:00Z',data:{about:'Local business',gallery:[],location:{latitude:i===44?19:21,longitude:72,area:'Mumbai',city:'Mumbai'}}}));client=fixture({businesses});
 let result=await appSnapshot(client,{id:owner},'businesses',0,{directory:true,location:{latitude:19,longitude:72}});assert.equal(result.state.businesses[0].id,'44');assert.equal(result.state.businesses.length,30);assert.equal(result.page.hasMore,true);assert.equal(result.page.total,45);
 result=await appSnapshot(client,{id:owner},'businesses',0,{directory:true,category:'Gym',location:{latitude:19,longitude:72}});assert.deepEqual(result.state.businesses.map(b=>b.id),['44']);assert.equal(result.page.total,1);
 result=await appSnapshot(client,{id:owner},'businesses',0,{directory:true,preview:true,location:{latitude:19,longitude:72}});assert.equal(result.state.businesses.length,3);assert.equal(result.state.businesses[0].id,'44');assert.equal(result.page.hasMore,false);
});
test('business notifications preserve recipient identity and exact unread totals beyond the loaded page',async()=>{
 const notifications=Array.from({length:35},(_,i)=>({id:String(i),recipient_id:owner,sender_id:peer,type:'message',title:'Message',message:'Hello',is_read:false,created_at:'2026-10-24T12:00:00Z'}));notifications.push({...notifications[0],id:'foreign',recipient_id:peer});client=fixture({notifications,profiles:[profile(peer,'Neighbour')],account_roles:[{user_id:owner,role:'business'}]});
 const result=await appSnapshot(client,{id:owner},'notifications');assert.equal(result.notifications.length,30);assert.equal(result.page.hasMore,true);assert.equal(result.unreadCount,35);assert.ok(result.notifications.every(n=>n.recipientId===owner&&n.recipientType==='business'));
});
test('administrator profile pages retain report counts using only counts for the visible identities',async()=>{
 client=fixture({profiles:[profile(peer,'Neighbour')],reports:[{id:'visible',reported_user_id:peer,reason:'Private reason'},{id:'unrelated',reported_user_id:'unrelated'}]});const result=await appSnapshot(client,{id:owner},'people',0,{allPosts:true});assert.equal(result.state.residents[0].reports,1);assert.equal(result.state.reports,undefined);assert.equal(client.calls.find(c=>c.table==='reports').columns,'reported_user_id');
});
