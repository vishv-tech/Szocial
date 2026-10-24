/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner. */
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
let db;
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
async function as(user,sql,params=[]){await db.exec('begin; set local role authenticated;');try{await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);const r=await db.query(sql,params);await db.exec('commit');return r.rows;}catch(e){await db.exec('rollback');throw e;}}
async function mutate(user,action,args={}){return (await as(user,'select public.app_mutate($1,$2::jsonb) as result',[action,JSON.stringify(args)]))[0].result;}
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth,public to authenticated,anon,service_role;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
 grant usage on schema storage to authenticated;grant select on storage.objects to authenticated;
 create publication supabase_realtime;
 `);
 for(const file of fs.readdirSync('supabase/migrations').sort())await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'a@example.test','{\"role\":\"admin\",\"full_name\":\"Resident A\"}'),($2,'b@example.test','{}'),($3,'c@example.test','{}')",[a,b,c]);
});
after(async()=>{await db?.close();});
let normal,help,chat,business;
test('signup trigger creates one profile; untrusted auth metadata grants no admin',async()=>{
 const roles=await as(a,'select role from public.account_roles');assert.deepEqual(roles,[{role:'resident'}]);
 await assert.rejects(as(a,"insert into public.account_roles values($1,'admin')",[a]),/permission denied/);
 await assert.rejects(mutate(a,'admin_verify_user',{id:a}),/Administrator required/);
});
test('RLS hides private profile details across accounts',async()=>{const rows=await as(a,'select user_id from public.profile_private');assert.deepEqual(rows,[{user_id:a}]);});
test('real database generated timestamps; edit ignores forged creation and ownership',async()=>{
 normal=(await mutate(a,'create_post',{type:'fun',category:'Cricket',title:'Wadala cricket',description:'Play',location:{area:'Wadala',city:'Mumbai',latitude:19.017,longitude:72.858}})).id;
 const [first]=await as(a,'select * from public.posts where id=$1',[normal]);
 await mutate(a,'update_post',{id:normal,title:'Wadala cricket edited',authorId:b,createdAt:'2000-01-01'});
 const [second]=await as(a,'select * from public.posts where id=$1',[normal]);assert.equal(second.created_at.getTime(),first.created_at.getTime());assert.equal(second.author_id,a);
 await assert.rejects(mutate(b,'update_post',{id:normal,title:'hijack'}),/Not your post/);
 await assert.rejects(as(b,'update public.posts set author_id=$1 where id=$2',[b,normal]),/permission denied/);
});
test('own help excluded by backend discovery; retained for personal read',async()=>{
 help=(await mutate(a,'create_post',{type:'help',category:'Tutor',title:'Help with maths',description:'Tutor needed',location:{area:'Wadala',city:'Mumbai'}})).id;
 const own=await as(a,"select id from public.discover_posts() where id=$1",[help]);assert.equal(own.length,0);
 assert.equal((await as(a,'select id from public.posts where id=$1',[help])).length,1);
 assert.equal((await as(b,'select id from public.discover_posts() where id=$1',[help])).length,1);
 await assert.rejects(mutate(b,'save_post',{id:help}),/Help posts cannot be saved/);
});
test('comments and interactions persist and saves are idempotent toggles',async()=>{
 await mutate(b,'comment',{id:normal,text:'Can I join?'});assert.equal((await as(a,'select * from public.comments where post_id=$1',[normal])).length,1);
 await mutate(b,'like',{id:normal});assert.equal((await as(a,'select * from public.post_likes where post_id=$1',[normal])).length,1);
 await mutate(b,'save_post',{id:normal});assert.equal((await as(b,'select * from public.post_saves')).length,1);assert.equal((await as(a,'select * from public.post_saves')).length,0);
});
test('database search and geographic sorting work before paging',async()=>{
 const far=(await mutate(a,'create_post',{type:'fun',category:'Cricket',title:'Andheri cricket',description:'Play',location:{area:'Andheri',city:'Mumbai',latitude:19.12,longitude:72.85}})).id;
 const query="select id from public.discover_posts(search_query=>'  CRICK ',viewer_lat=>19.017,viewer_lng=>72.858,page_size=>1,page_offset=>$1)";
 assert.equal((await as(b,query,[0]))[0].id,normal);assert.equal((await as(b,query,[1]))[0].id,far);
 assert.equal((await as(b,"select id from public.discover_posts(search_query=>'Andheri')"))[0].id,far);
 assert.equal((await as(b,"select id from public.discover_posts(search_query=>'no match')")).length,0);
});
test('conversation creation is repeat-safe; only participants read messages',async()=>{
 chat=(await mutate(b,'start_chat',{postId:normal})).id;assert.equal((await mutate(b,'start_chat',{postId:normal})).id,chat);
 await mutate(a,'message',{id:chat,clientId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',text:'Hello'});
 await mutate(a,'message',{id:chat,clientId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',text:'Hello'});
 assert.equal((await as(b,'select * from public.messages where conversation_id=$1',[chat])).length,1);
 assert.equal((await as(c,'select * from public.messages where conversation_id=$1',[chat])).length,0);
 await assert.rejects(mutate(c,'message',{id:chat,clientId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',text:'Intruder'}),/Messaging unavailable/);
 await assert.rejects(mutate(a,'message',{id:chat,clientId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',text:'  '}),/check constraint/);
});
test('blocks persist and prevent sends in both directions and new threads',async()=>{
 await mutate(b,'block',{id:chat,blocked:true});
 for(const user of [a,b])await assert.rejects(mutate(user,'message',{id:chat,clientId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',text:'blocked'}),/Messaging unavailable/);
 await assert.rejects(mutate(a,'start_chat',{postId:help}),/Post unavailable|Messaging unavailable/);
 await mutate(a,'block',{id:chat,blocked:false}); // cannot remove another user's block
 await assert.rejects(mutate(a,'message',{id:chat,clientId:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',text:'still blocked'}),/Messaging unavailable/);
 await mutate(b,'block',{id:chat,blocked:false});
 await mutate(a,'message',{id:chat,clientId:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',text:'unblocked'});
});
test('report records identify actors/targets and suppress repeat submissions',async()=>{
 await mutate(b,'report',{id:chat,itemType:'Chat',itemLabel:'Chat',reason:'Harassment'});await mutate(b,'report',{id:chat,itemType:'Chat',itemLabel:'Chat',reason:'Harassment'});
 const reports=await as(b,'select * from public.reports');assert.equal(reports.length,1);assert.equal(reports[0].reporter_id,b);assert.equal(reports[0].reported_user_id,a);
 assert.equal((await as(c,'select * from public.reports')).length,0);
 await assert.rejects(mutate(c,'report',{id:chat,itemType:'Chat',itemLabel:'Chat',reason:'Spam'}),/unavailable/);
});
test('business ownership and role are created transactionally; other accounts cannot edit',async()=>{
 business=(await mutate(c,'create_business',{businessName:'Test cafe',category:'Cafe',address:'Mumbai',location:{area:'Matunga',city:'Mumbai'}})).id;
 assert.ok((await as(c,'select role from public.account_roles')).some(r=>r.role==='business'));
 await assert.rejects(mutate(a,'business_profile',{id:business,name:'Stolen'}),/Not your business/);
 await assert.rejects(mutate(c,'business_status',{id:business,status:'Live'}),/verified subscription/);
});
test('prices are server controlled and clients cannot finalize or read others payments',async()=>{
 await assert.rejects(as(a,"select public.reserve_payment($1,'starter',$2,'test')",[business,'ffffffff-ffff-4fff-8fff-ffffffffffff']),/Not your business/);
 const [reserved]=await as(c,"select (public.reserve_payment($1,'starter',$2,'test')).*",[business,'ffffffff-ffff-4fff-8fff-ffffffffffff']);assert.equal(reserved.amount_paise,9900);
 await assert.rejects(as(c,"select public.finalize_payment('order','payment',1,'test')"),/permission denied/);
 await assert.rejects(as(c,"update public.payments set status='paid'"),/permission denied/);
 assert.equal((await as(a,'select * from public.payments')).length,0);
});
test('notification read is scoped to the recipient and client cannot forge notifications',async()=>{
 assert.ok((await as(a,'select * from public.notifications')).length>0);await mutate(a,'read_notifications');
 assert.ok((await as(a,'select * from public.notifications')).every(n=>n.is_read));
 await assert.rejects(as(b,"insert into public.notifications(recipient_id,type,title,message) values($1,'system','fake','fake')",[a]),/permission denied/);
});
test('all exposed tables have RLS and anonymous users cannot read application records',async()=>{
 const rows=(await db.query("select relname,relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r'")).rows;
 assert.ok(rows.every(r=>r.relrowsecurity));await db.exec('begin; set local role anon;');try{await assert.rejects(db.query('select * from public.posts'),/permission denied/);}finally{await db.exec('rollback');}
});
test('media references require the same owner, scope and entity; detached images stay private',async()=>{
 const ownPath=a+'/profile/avatar.webp',otherPath=b+'/profile/avatar.webp';
 await db.query("insert into public.media(owner_id,bucket,path,scope) values($1,'szocial-avatars',$2,'avatar'),($3,'szocial-avatars',$4,'avatar')",[a,ownPath,b,otherPath]);
 await mutate(a,'profile',{profilePhoto:ownPath});
 await assert.rejects(mutate(a,'profile',{profilePhoto:otherPath}),/unowned image/);
 assert.equal((await as(c,'select path from public.media where path=$1',[otherPath])).length,0);
 assert.equal((await as(c,'select path from public.media where path=$1',[ownPath])).length,1);
 await assert.rejects(db.query('delete from public.media where path=$1',[ownPath]),/still referenced/);
 await mutate(a,'profile',{profilePhoto:''});
 assert.equal((await as(c,'select path from public.media where path=$1',[ownPath])).length,0);
 await db.query('delete from public.media where path=$1',[ownPath]);
 await assert.rejects(mutate(a,'update_post',{id:normal,images:[otherPath]}),/unowned image/);
});
test('untrusted metadata and precise coordinates cannot bypass column ownership or location checks',async()=>{
 await mutate(a,'update_post',{id:normal,authorId:b,status:'Active',images:[],savedByUserIds:[c],__dangerous:'value'});
 const [p]=await as(a,'select * from public.posts where id=$1',[normal]);assert.equal(p.author_id,a);assert.equal(p.data.__dangerous,undefined);
 await assert.rejects(mutate(a,'profile',{privacy:{allowDirectMessages:'false'}}),/Invalid privacy/);
 await assert.rejects(mutate(a,'profile',{location:{latitude:91,longitude:0}}),/Invalid coordinates/);
 await assert.rejects(mutate(a,'message',{id:chat,kind:'location',text:'Invalid',clientId:'aaaabbbb-1111-4111-8111-111111111111'}),/coordinates/);
});
test('Help closes into Solved and image uploads can start as a private draft',async()=>{
 await mutate(a,'close_post',{id:help});assert.equal((await as(b,"select * from public.discover_posts(post_status=>'Solved') where id=$1",[help])).length,1);
 const draft=(await mutate(a,'create_post',{type:'fun',category:'Other',title:'Private upload draft',withImages:true})).id;
 assert.equal((await as(a,'select status from public.posts where id=$1',[draft]))[0].status,'Draft');
 assert.equal((await as(b,'select id from public.posts where id=$1',[draft])).length,0);
});
test('acceptance creates shared chat and persists a recipient notification',async()=>{
 await mutate(c,'interest',{id:normal});const accepted=await mutate(a,'accept',{id:normal,userId:c});
 assert.equal((await as(c,'select id from public.conversations where id=$1',[accepted.id])).length,1);
 assert.ok((await as(c,"select id from public.notifications where type='accepted'")).length>0);
});
test('both participants can block independently and each removes only their own block',async()=>{
 await mutate(a,'block',{id:chat,blocked:true});await mutate(b,'block',{id:chat,blocked:true});
 assert.equal((await as(a,'select * from public.blocks')).length,2);
 await mutate(a,'block',{id:chat,blocked:false});
 await assert.rejects(mutate(a,'message',{id:chat,text:'Still blocked',clientId:'aaaaaaaa-2222-4222-8222-222222222222'}),/Messaging unavailable/);
 await mutate(b,'block',{id:chat,blocked:false});
});
test('inactive accounts cannot read any private data or receive new messages',async()=>{
 await db.query("update public.profiles set account_status='Banned' where id=$1",[b]);
 for(const table of ['profile_private','account_roles','blocks','notifications','messages','payments'])assert.equal((await as(b,'select * from public.'+table)).length,0,table);
 await assert.rejects(mutate(a,'message',{id:chat,text:'Banned peer',clientId:'aaaaaaaa-3333-4333-8333-333333333333'}),/Messaging unavailable/);
 await db.query("update public.profiles set account_status='Active' where id=$1",[b]);
});
test('captured payments, renewals, partial refunds and full refunds are idempotent',async()=>{
 const [p]=(await db.query('select * from public.payments where business_id=$1',[business])).rows;
 await db.query("update public.payments set razorpay_order_id='order_test' where id=$1",[p.id]);
 await db.query("select public.reconcile_payment('order_test','pay_test',9900,'test',0)");
 const [first]=(await db.query('select * from public.subscriptions where business_id=$1',[business])).rows;
 await db.query("select public.reconcile_payment('order_test','pay_test',9900,'test',0)");
 assert.equal((await db.query('select active_until from public.subscriptions where business_id=$1',[business])).rows[0].active_until.getTime(),first.active_until.getTime());
 await db.query("select public.reconcile_payment('order_test','pay_test',9900,'test',500)");
 assert.equal((await db.query('select refunded_paise from public.payments where id=$1',[p.id])).rows[0].refunded_paise,500);
 assert.ok((await db.query('select active_until>now() as active from public.subscriptions where business_id=$1',[business])).rows[0].active);
 await assert.rejects(as(c,"select public.reconcile_payment('order_test','pay_test',9900,'test',9900)"),/permission denied/);
 await assert.rejects(db.query("select public.reconcile_payment('order_test','other_pay',9900,'test',0)"),/already reconciled/);
 await assert.rejects(db.query("select public.reconcile_payment('order_test','pay_test',1,'test',0)"),/does not match/);
 await db.query("select public.reconcile_payment('order_test','pay_test',9900,'test',9900)");
 await db.query("select public.reconcile_payment('order_test','pay_test',9900,'test',9900)");
 assert.equal((await db.query('select status from public.payments where id=$1',[p.id])).rows[0].status,'refunded');
 assert.equal((await db.query('select active_until>now() as active from public.subscriptions where business_id=$1',[business])).rows[0].active,false);
});
test('business offer edits persist actual rows and malformed listing collections are rejected',async()=>{
 await mutate(c,'business_profile',{id:business,offers:['First offer','Second offer'],services:['Coffee']});
 assert.equal((await as(c,'select * from public.business_offers where business_id=$1',[business])).length,2);
 await mutate(c,'business_profile',{id:business,offers:['Second offer']});
 assert.equal((await as(c,'select * from public.business_offers where business_id=$1',[business])).length,1);
 await assert.rejects(mutate(c,'business_profile',{id:business,services:'not an array'}),/Invalid listing/);
 await assert.rejects(mutate(a,'business_profile',{id:business,offers:[]}),/Not your business/);
});
test('repeated acceptance returns the same chat without duplicate notifications',async()=>{
 const before=(await as(c,"select * from public.notifications where type='accepted'")).length;
 const first=await mutate(a,'accept',{id:normal,userId:c});const second=await mutate(a,'accept',{id:normal,userId:c});assert.equal(first.id,second.id);
 assert.equal((await as(c,"select * from public.notifications where type='accepted'")).length,before);
});
test('an expired listing is hidden and cannot receive a new business conversation',async()=>{
 await db.query("update public.businesses set status='Live' where id=$1",[business]);
 assert.equal((await as(a,'select id from public.businesses where id=$1',[business])).length,0);
 await assert.rejects(mutate(a,'start_chat',{businessId:business}),/subscription expired/);
});
test('purchase retries reuse pending reservations and cannot change payment environment',async()=>{
 const [first]=await as(c,"select (public.reserve_payment($1,'growth',$2,'test')).*",[business,'dddddddd-1111-4111-8111-111111111111']);
 const [second]=await as(c,"select (public.reserve_payment($1,'growth',$2,'test')).*",[business,'dddddddd-2222-4222-8222-222222222222']);assert.equal(first.id,second.id);
 await assert.rejects(as(c,"select public.reserve_payment($1,'growth',$2,'live')",[business,'dddddddd-1111-4111-8111-111111111111']),/another purchase/);
});
test('refunding an earlier prepaid renewal preserves the later paid entitlement',async()=>{
 const purchase=async(key,order)=>{const [p]=await as(c,"select (public.reserve_payment($1,'starter',$2,'test')).*",[business,key]);await db.query('update public.payments set razorpay_order_id=$1 where id=$2',[order,p.id]);await db.query('select public.reconcile_payment($1,$2,9900,\'test\',0)',[order,'pay_'+order]);return p;};
 await purchase('eeeeeeee-1111-4111-8111-111111111111','renewal_one');await purchase('eeeeeeee-2222-4222-8222-222222222222','renewal_two');
 const before=(await db.query('select active_until from public.subscriptions where business_id=$1',[business])).rows[0].active_until;
 await db.query("select public.reconcile_payment('renewal_one','pay_renewal_one',9900,'test',9900)");
 const after=(await db.query('select active_until from public.subscriptions where business_id=$1',[business])).rows[0].active_until;
 assert.ok(after<before);assert.ok(after>Date.now()+29*86400000);
 await db.query("select public.reconcile_payment('renewal_one','pay_renewal_one',9900,'test',9900)");
 assert.equal((await db.query('select active_until from public.subscriptions where business_id=$1',[business])).rows[0].active_until.getTime(),after.getTime());
});
