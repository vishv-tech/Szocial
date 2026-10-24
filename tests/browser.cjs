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
let auth,app,browser,log;let failSend=false,createdPosts=0;
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
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Kolkata'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const navigate=async path=>{await page.evaluate(path=>window.location.assign(path),path);await page.waitForURL('**'+path);};
  await page.addInitScript(()=>{localStorage.setItem('szocial_auth','true');localStorage.setItem('szocial_user',JSON.stringify({id:'user-vishv',role:'admin'}));});
  await page.goto('http://localhost:3010/home');await page.getByRole('heading',{name:'Resident login',exact:true}).waitFor();
  console.log('PASS legacy localStorage flags do not authenticate');
  await page.route('**/api/app',async route=>{
   if(route.request().method()==='POST'){
    const {action,args}=route.request().postDataJSON();
    if(action==='create_post'){createdPosts++;}
    if(action==='message'){
     if(failSend){await route.fulfill({status:503,json:{error:'Simulated write failure'}});return;}
     if(!chat.messages.some(m=>m.id===args.clientId))chat.messages.push({id:args.clientId,senderId:user.id,senderType:'resident',text:args.text,kind:'text',createdAt:new Date().toISOString()});
    }else if(action==='read_chat'){chat.readAtByParticipant={...chat.readAtByParticipant,[user.id]:new Date().toISOString()};}else if(action==='block'){chat.status=args.blocked?'Blocked':'Active';chat.blockedByIds=args.blocked?[user.id]:[];chat.blockedById=args.blocked?user.id:undefined;chat.blockedByType='resident';}
    else if(action==='profile'){Object.assign(user,args);}
    await route.fulfill({json:{id:args.id??'created',success:true}});return;
   }
   await route.fulfill({json:{state,notifications:[],roles:['resident'],onboardingComplete:true}});
  });
  await page.route('**/api/feed?*',async route=>{const q=new URL(route.request().url()).searchParams;let posts=discoveryPosts(state.posts,user.id,state.chats,q.get('status')==='Solved');if(q.get('type'))posts=posts.filter(p=>p.type===q.get('type'));posts=queryPosts(posts,q.get('q')??'',q.get('sort')??'nearby',state.location);await route.fulfill({json:{posts,hasMore:false}});});
  await page.route('**/api/messages?*',route=>route.fulfill({json:{messages:[{id:'earlier',senderId:'user-aarya',senderType:'resident',kind:'text',text:'Earlier paginated message',createdAt:'2026-05-01T10:00:00Z'}],hasMore:false}}));
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
  console.log('PASS history pagination, shared response rendering, reload, blocking, draft retention and retry');
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
  assert.deepEqual(errors,[]);console.log('PASS mobile browser regressions; Auth and application services are test doubles');
 }finally{if(browser)await browser.close();if(app)app.kill('SIGTERM');if(auth)await new Promise(resolve=>auth.close(resolve));if(log)fs.closeSync(log);}
})().catch(error=>{console.error(error);process.exitCode=1;});
