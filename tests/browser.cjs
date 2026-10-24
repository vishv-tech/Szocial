/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Playwright regression harness. */
// Uses a local Auth test double and mocked application responses. This verifies
// browser behavior and cookie route guards, not hosted Supabase/OAuth/Storage.
require('./register.cjs');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const {createServer}=require('node:http');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {initialAppState}=require('../lib/mock-data.ts');
const {queryPosts,discoveryPosts}=require('../lib/feed.ts');
const state=JSON.parse(JSON.stringify(initialAppState).replaceAll('user-vishv','11111111-1111-4111-8111-111111111111')),user=state.residents[0];state.currentUserId=user.id;state.currentBusinessOwnerId=null;
user.location=state.location={area:'Wadala',city:'Mumbai',latitude:19.017,longitude:72.858,source:'manual'};
const base={...state.posts[0],authorId:'user-aarya',type:'fun',category:'Cricket',status:'Active',visibility:'Public',acceptedUserIds:[],comments:[]};
state.posts=[{...base,id:'near',title:'Nearby cricket',location:user.location,createdAt:'2026-10-20T10:00:00Z'},
 {...base,id:'far',title:'Far cricket',location:{area:'Andheri',city:'Mumbai',latitude:19.12,longitude:72.85},createdAt:'2026-10-21T10:00:00Z'},
 {...base,id:'ownhelp',title:'Own hidden help',type:'help',authorId:user.id},
 {...base,id:'otherhelp',title:'Other visible help',type:'help',location:user.location},
 {...base,id:'unknown',title:'Missing author post',authorId:'deleted-user'}];
const chat=state.chats.find(c=>c.id==='chat-cricket');chat.historyHasMore=true;chat.status='Active';chat.blockedByIds=[];
const authUser={id:user.id,aud:'authenticated',role:'authenticated',email:'browser@example.invalid',email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{}};
const jwt=[{alg:'HS256',typ:'JWT'},{sub:user.id,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated',role:'authenticated'},'test-signature'].map((x,i)=>i===2?x:Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');
let auth,app,browser,log;let failSend=false,createdPosts=0,feedDelay=0,feedFailure=0,feedCalls=0,interestCalls=0;const appCalls=[],testNotifications=[],liveSockets=new Map();let socketJoins=0;
(async()=>{
 try{
  auth=createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');if(req.method==='OPTIONS'){res.end();return;}
   if(req.url.startsWith('/auth/v1/token'))res.end(JSON.stringify({access_token:jwt,refresh_token:'test-only-refresh',expires_in:3600,token_type:'bearer',user:authUser}));
   else if(req.url.startsWith('/auth/v1/user'))res.end(JSON.stringify(authUser));
   else if(req.url.startsWith('/auth/v1/logout'))res.end('{}');
   else if(req.url.startsWith('/rest/v1/profile_private'))res.end(JSON.stringify({onboarding_complete:true}));
   else if(req.url.startsWith('/rest/v1/profiles'))res.end(JSON.stringify(req.headers.accept?.includes('object')?{account_status:'Active'}:[{account_status:'Active'}]));
   else if(req.url.startsWith('/rest/v1/account_roles'))res.end(JSON.stringify([{role:'resident'}]));
   else res.end('[]');
  });await new Promise(resolve=>auth.listen(54329,'127.0.0.1',resolve));
  log=fs.openSync('/tmp/szocial-browser-server.log','w');
  app=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3010'],{stdio:['ignore',log,log],env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54329',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'test-only-publishable',SUPABASE_SECRET_KEY:''}});
  let ready=false;for(let n=0;n<90;n++){try{if((await fetch('http://localhost:3010/login')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}assert.ok(ready,'Next test server started');
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Kolkata'});
  await context.routeWebSocket('**/realtime/v1/websocket**',ws=>{
   const channels=new Map();liveSockets.set(ws,channels);ws.onClose(()=>liveSockets.delete(ws));
   ws.onMessage(raw=>{const input=JSON.parse(String(raw)),array=Array.isArray(input),m=array?{join_ref:input[0],ref:input[1],topic:input[2],event:input[3],payload:input[4]}:input;
    const send=(event,payload)=>ws.send(JSON.stringify(array?[m.join_ref,m.ref,m.topic,event,payload]:{...m,event,payload}));
    if(m.event==='phx_join'){socketJoins++;const bindings=(m.payload.config?.postgres_changes??[]).map((v,i)=>({...v,id:i+1}));channels.set(m.topic,{array,join_ref:m.join_ref,bindings});send('phx_reply',{status:'ok',response:{postgres_changes:bindings}});}
    if(m.event==='phx_leave'){channels.delete(m.topic);send('phx_reply',{status:'ok',response:{}});}if(m.event==='heartbeat')send('phx_reply',{status:'ok',response:{}});
   });
  });
  const emit=(table,type,record={},old_record={})=>{for(const [ws,channels] of liveSockets)for(const [topic,m] of channels){const payload={ids:m.bindings.filter(b=>b.table===table).map(b=>b.id),data:{schema:'public',table,type,commit_timestamp:new Date().toISOString(),columns:Object.keys({...record,...old_record}).map(name=>({name,type:'text'})),record,old_record}};ws.send(JSON.stringify(m.array?[m.join_ref,null,topic,'postgres_changes',payload]:{topic,event:'postgres_changes',payload}));}};
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Browser runtime error:',e.message);});const navigate=async path=>{await page.evaluate(path=>window.location.assign(path),path);await page.waitForURL('**'+path);};
  await page.addInitScript(()=>{localStorage.setItem('szocial_auth','true');localStorage.setItem('szocial_user',JSON.stringify({id:'user-vishv',role:'admin'}));});
  await page.goto('http://localhost:3010/home');await page.getByRole('heading',{name:'Resident login',exact:true}).waitFor();
  console.log('PASS legacy localStorage flags do not authenticate');
  await page.route('**/api/app*',async route=>{
   if(route.request().method()==='POST'){
    const {action,args}=route.request().postDataJSON();
    if(action==='interest'){interestCalls++;await new Promise(r=>setTimeout(r,150));const post=state.posts.find(p=>p.id===args.id);if(post)post.interestedUserIds=post.interestedUserIds.includes(user.id)?post.interestedUserIds.filter(id=>id!==user.id):[...post.interestedUserIds,user.id];}
    if(action==='create_post'){createdPosts++;}if(action==='read_notifications')testNotifications.forEach(n=>n.isRead=true);
    if(action==='message'){
     if(failSend){await route.fulfill({status:503,json:{error:'Simulated write failure'}});return;}
     if(!chat.messages.some(m=>m.id===args.clientId))chat.messages.push({id:args.clientId,senderId:user.id,senderType:'resident',text:args.text,kind:'text',createdAt:new Date().toISOString()});
    }else if(action==='read_chat'){chat.readAtByParticipant={...chat.readAtByParticipant,[user.id]:new Date().toISOString()};}else if(action==='block'){chat.status=args.blocked?'Blocked':'Active';chat.blockedByIds=args.blocked?[user.id]:[];chat.blockedById=args.blocked?user.id:undefined;chat.blockedByType='resident';}
    else if(action==='profile'){Object.assign(user,args);}
    await route.fulfill({json:{id:args.id??'created',success:true}});return;
   }
   appCalls.push(new URL(route.request().url()).searchParams.get('domain')??'core');await route.fulfill({json:{actorId:state.currentUserId,state,notifications:testNotifications,unreadCount:testNotifications.filter(n=>!n.isRead).length,roles:['resident'],onboardingComplete:true}});
  });
  await page.route('**/api/feed?*',async route=>{feedCalls++;if(feedDelay)await new Promise(r=>setTimeout(r,feedDelay));if(feedFailure){await route.fulfill({status:feedFailure,json:{error:feedFailure===401?'Authentication required':'Temporary feed outage'}});return;}const q=new URL(route.request().url()).searchParams;let posts=discoveryPosts(state.posts,user.id,state.chats,q.get('status')==='Solved');if(q.get('type'))posts=posts.filter(p=>p.type===q.get('type'));posts=queryPosts(posts,q.get('q')??'',q.get('sort')??'nearby',state.location);const offset=Number(q.get('offset')??0);await route.fulfill({json:{posts:posts.slice(offset,offset+20),hasMore:posts.length>offset+20}});});
  await page.route('**/api/messages?*',route=>{const q=new URL(route.request().url()).searchParams;return route.fulfill({json:q.has('before')?{messages:[{id:'earlier',senderId:'user-aarya',senderType:'resident',kind:'text',text:'Earlier paginated message',createdAt:'2026-05-01T10:00:00Z'}],hasMore:false}:{messages:chat.messages,hasMore:true}});});
  await page.getByLabel(/^Email/).fill('browser@example.invalid');await page.getByLabel(/^Password/).fill('test-only-password');await page.getByRole('button',{name:'Login',exact:true}).click();
  await page.getByRole('heading',{name:'Nearby cricket',exact:true}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Own hidden help'}).count(),0);
  await page.getByRole('searchbox').fill('  CRICK ');await page.getByRole('heading',{name:'Missing author post'}).waitFor({state:'detached'});
  await page.getByRole('combobox').selectOption('newest');await page.waitForFunction(()=>document.querySelector('article h3')?.textContent==='Far cricket');
  await page.getByRole('searchbox').fill('nomatch');await page.getByText('No local posts found',{exact:true}).waitFor();
  await navigate('/explore');await page.getByRole('heading',{name:'Nearby cricket',exact:true}).waitFor();
  const unknown=page.locator('article').filter({has:page.getByRole('heading',{name:'Missing author post',exact:true})});assert.ok(await unknown.getByText('Unavailable resident',{exact:true}).count());
  await navigate('/help');await page.getByRole('heading',{name:'Other visible help',exact:true}).waitFor();assert.equal(await page.getByText('Own hidden help',{exact:true}).count(),0);
  console.log('PASS Home, Explore, Help, search, sorting and missing author identity');
  await navigate('/profile');await page.getByRole('button',{name:'Edit Profile',exact:true}).click();assert.equal(await page.locator('input:not([type=file]):not([type=checkbox])').first().inputValue(),user.name);await page.keyboard.press('Escape');
  await navigate('/chats?chatId=chat-cricket');const input=page.getByPlaceholder('Type a message...');await input.waitFor();await page.getByRole('button',{name:'Load earlier messages'}).click();await page.getByText('Earlier paginated message',{exact:true}).waitFor();
  await input.fill('Browser regression message');await page.getByRole('button',{name:'Send',exact:true}).click();await page.getByText('Browser regression message',{exact:true}).last().waitFor();
  await page.reload();await page.getByText('Browser regression message',{exact:true}).last().waitFor();
  page.on('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Block',exact:true}).click();await page.getByRole('button',{name:'Unblock',exact:true}).waitFor();assert.equal(await input.isDisabled(),true);
  await page.getByRole('button',{name:'Unblock',exact:true}).click();await page.getByRole('button',{name:'Block',exact:true}).waitFor();assert.equal(await input.isEnabled(),true);
  failSend=true;await input.fill('Keep my draft after failure');await page.getByRole('button',{name:'Send',exact:true}).click();await page.getByText('Changes were not saved',{exact:true}).waitFor();assert.equal(await input.inputValue(),'Keep my draft after failure');failSend=false;
  await page.getByRole('button',{name:'Send',exact:true}).click();await page.getByText('Keep my draft after failure',{exact:true}).last().waitFor();
  await page.waitForTimeout(350);const messageAppCalls=appCalls.length,incoming={id:'realtime-message',senderId:'user-aarya',senderType:'resident',kind:'text',text:'Incoming targeted message',createdAt:new Date(Date.now()+1000).toISOString()};chat.messages.push(incoming);chat.lastMessageAt=incoming.createdAt;emit('messages','INSERT',{id:incoming.id,conversation_id:chat.id,sender_id:incoming.senderId,created_at:incoming.createdAt});await page.getByText(incoming.text,{exact:true}).last().waitFor();assert.equal(appCalls.length,messageAppCalls);
  console.log('PASS history pagination, targeted incoming message, shared response rendering, reload, blocking, draft retention and retry');
  await navigate('/post?type=help');await page.getByLabel(/^Title/).fill('Draft attachment retry');await page.getByLabel(/^Description/).fill('Help request with an attachment');
  await page.getByLabel('Post images',{exact:true}).setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from('test-only-bytes')});
  await page.route('**/api/uploads',route=>route.fulfill({status:503,json:{error:'Simulated Storage outage'}}));
  await page.getByRole('button',{name:'Post Help Request',exact:true}).click();await page.getByText('Post saved as draft',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Post Help Request',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('input[type=file]').length>0);assert.equal(createdPosts,1);
  console.log('PASS attachment failure retries reuse the existing post draft');
  await navigate('/profile');await page.route('**/api/auth/logout',route=>route.fulfill({status:503,json:{error:'Simulated logout outage'}}));
  await page.getByRole('button',{name:'Logout',exact:true}).click();await page.getByText('Authentication failed',{exact:true}).waitFor();assert.ok(page.url().endsWith('/profile'));await page.unroute('**/api/auth/logout');
  console.log('PASS failed logout keeps the user on the profile with an error');
  await page.evaluate(()=>window.location.assign('/admin'));await page.waitForURL('**/home');console.log('PASS resident cannot enter administrator routes');
  // Protocol-level Realtime events exercise the real browser subscriber and cache.
  await navigate('/home');await page.getByRole('heading',{name:'Nearby cricket',exact:true}).waitFor();await page.waitForTimeout(700);assert.ok(socketJoins>0);
  const beforeUnrelated=feedCalls;emit('notifications','INSERT',{id:'notice'});await page.waitForTimeout(400);assert.equal(feedCalls,beforeUnrelated);
  await page.getByRole('searchbox').fill('unique match');await page.getByText('No local posts found',{exact:true}).waitFor();await page.waitForTimeout(300);
  const outside=feedCalls;emit('posts','INSERT',{id:'outside',type:'fun',title:'Unrelated walk',description:'A local walk',category:'Adventure',status:'Active'});await page.waitForTimeout(350);assert.equal(feedCalls,outside);
  const added={...base,id:'live',title:'Unique match from Realtime',description:'A matching new post',createdAt:'2026-10-24T13:00:00Z',location:user.location};state.posts.push(added);
  emit('posts','INSERT',{id:added.id,type:'fun',title:added.title,description:added.description,category:added.category,status:'Active'});await page.getByRole('heading',{name:added.title,exact:true}).waitFor();
  const interestBefore=interestCalls;await page.locator('article').filter({has:page.getByRole('heading',{name:added.title,exact:true})}).getByRole('button',{name:/^(Interest Sent|I'm Available)$/}).evaluate(button=>{button.click();button.click();button.click();});await page.waitForTimeout(650);assert.equal(interestCalls-interestBefore,1);
  // A burst changes only the active feed, keeps its DOM node, and never flashes initial loading.
  const card=await page.getByRole('heading',{name:added.title,exact:true}).elementHandle(),refreshStart=feedCalls,appStart=appCalls.length;feedDelay=600;
  for(let n=0;n<8;n++)emit('posts','UPDATE',{id:'live',title:added.title});await page.waitForTimeout(350);assert.equal(await page.getByText('Loading posts…',{exact:true}).count(),0);assert.equal(await card.evaluate(el=>el.isConnected),true);
  await page.waitForTimeout(800);assert.equal(feedCalls-refreshStart,1);assert.equal(appCalls.length,appStart);feedDelay=0;
  feedFailure=503;emit('posts','UPDATE',{id:'live'});await page.getByText(/^Temporary feed outage/).waitFor();assert.equal(await card.evaluate(el=>el.isConnected),true);feedFailure=0;await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByText(/^Temporary feed outage/).waitFor({state:'detached'});
  state.posts.splice(state.posts.findIndex(p=>p.id==='live'),1);emit('posts','DELETE',{}, {id:'live'});await page.getByRole('heading',{name:added.title,exact:true}).waitFor({state:'detached'});
  console.log('PASS matching/outside-filter Realtime, burst coalescing, stable cards, slow refresh, outage/retry and deletion');
  await page.getByRole('searchbox').fill('paged');state.posts=Array.from({length:45},(_,n)=>({...base,id:'paged-'+n,title:'Paged cricket '+n,createdAt:new Date(Date.parse('2026-10-24T12:00:00Z')-n*1000).toISOString(),location:user.location}));emit('posts','INSERT',{id:'paged-0',type:'fun',title:'Paged cricket',description:'Meetup',category:'Cricket',status:'Active'});await page.getByRole('heading',{name:'Paged cricket 0',exact:true}).waitFor();await page.getByRole('button',{name:'Load more posts',exact:true}).click();await page.getByRole('heading',{name:'Paged cricket 39',exact:true}).waitFor();
  await page.getByRole('combobox').selectOption('newest');await page.getByRole('heading',{name:'Paged cricket 0',exact:true}).waitFor();await page.getByRole('button',{name:'Load more posts',exact:true}).click();await page.getByRole('heading',{name:'Paged cricket 39',exact:true}).waitFor();await page.evaluate(()=>window.scrollTo(0,900));await page.waitForTimeout(100);
  // Tap the upper corner of Home to avoid the development-only Next.js indicator.
  // SPA navigation retains the same account cache and selection.
  await page.getByRole('link',{name:'Explore',exact:true}).last().click();await page.getByRole('heading',{name:/Everything local around/}).waitFor();await page.getByRole('link',{name:'Home',exact:true}).last().click({position:{x:5,y:5}});await page.getByRole('heading',{name:'Paged cricket 39',exact:true}).waitFor();assert.equal(await page.getByRole('searchbox').inputValue(),'paged');assert.equal(await page.getByRole('combobox').inputValue(),'newest');await page.waitForTimeout(250);assert.ok(await page.evaluate(()=>window.scrollY)>400);
  await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}));const hiddenCalls=feedCalls;emit('posts','UPDATE',{id:'paged-0'});await page.waitForTimeout(450);assert.equal(feedCalls,hiddenCalls);
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(650);assert.ok(feedCalls>hiddenCalls);assert.equal(await page.getByText('Loading posts…',{exact:true}).count(),0);
  const joinsBefore=socketJoins;for(const [ws] of liveSockets){liveSockets.delete(ws);ws.close({code:1012,reason:'Isolated reconnect test'});}await page.waitForFunction(()=>true);for(let n=0;n<40&&socketJoins===joinsBefore;n++)await page.waitForTimeout(150);assert.ok(socketJoins>joinsBefore);await page.getByRole('heading',{name:'Paged cricket 39',exact:true}).waitFor();
  const focusStart=feedCalls;await page.evaluate(()=>{for(let n=0;n<10;n++)window.dispatchEvent(new Event('focus'));});await page.waitForTimeout(500);assert.ok(feedCalls-focusStart<=2);assert.equal(await page.getByText('Loading posts…',{exact:true}).count(),0);
  console.log('PASS two-page cache, sort/query/scroll preservation, tab navigation, reconnect and focus burst');
  testNotifications.push({id:'notice',recipientId:user.id,senderId:'user-aarya',senderName:'Neighbour',type:'message',title:'Targeted notification',message:'Your neighbour replied',entityId:'',entityType:'chat',isRead:false,createdAt:new Date().toISOString()});const notifyFeed=feedCalls;emit('notifications','INSERT',{id:'notice',recipient_id:user.id});await page.waitForTimeout(400);await page.getByRole('button',{name:'Open notifications'}).click();await page.getByRole('heading',{name:'Targeted notification',exact:true}).waitFor();assert.equal(feedCalls,notifyFeed);await page.getByRole('button',{name:'Close modal',exact:true}).click();await page.getByRole('heading',{name:'Notifications',exact:true}).waitFor({state:'detached'});
  // A successful logout clears the first account before the next sign-in.
  await page.getByRole('link',{name:'Profile',exact:true}).last().click();await page.getByRole('button',{name:'Logout',exact:true}).click();await page.setViewportSize({width:1440,height:1000});await page.getByRole('link',{name:'Login',exact:true}).click();await page.getByRole('heading',{name:'Resident login',exact:true}).waitFor();
  const secondId='44444444-4444-4444-8444-444444444444';state.currentUserId=secondId;state.residents=[{...user,id:secondId,name:'Second account'}];state.posts=[{...base,id:'second-only',title:'Second account feed',authorId:'user-aarya',location:user.location}];state.chats=[];testNotifications.length=0;
  await page.getByLabel(/^Email/).fill('second@example.invalid');await page.getByLabel(/^Password/).fill('test-only-password');await page.getByRole('button',{name:'Login',exact:true}).click();await page.getByRole('heading',{name:'Second account feed',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Paged cricket 0',exact:true}).count(),0);assert.equal(await page.getByRole('searchbox').inputValue(),'');
  console.log('PASS logout and independent account switch clear cached pages, notifications and selections');
  feedFailure=401;emit('posts','UPDATE',{id:'second-only'});await page.getByRole('heading',{name:'Second account feed',exact:true}).waitFor({state:'detached'});assert.equal(await page.getByRole('searchbox').inputValue(),'');feedFailure=0;
  console.log('PASS targeted notifications and expired authentication clears account feeds/preferences');
  assert.deepEqual(errors,[]);console.log('PASS mobile browser regressions; Auth and application services are test doubles');
 }finally{if(browser)await browser.close();if(app)app.kill('SIGTERM');if(auth)await new Promise(resolve=>auth.close(resolve));if(log)fs.closeSync(log);}
})().catch(error=>{console.error(error);process.exitCode=1;});
