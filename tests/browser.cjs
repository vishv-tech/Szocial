/* eslint-disable @typescript-eslint/no-require-imports -- Standalone optional Playwright smoke test. */
require('./register.cjs');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { initialAppState } = require('../lib/mock-data.ts');
(async () => {
 const browser = await chromium.launch({headless:true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"]});
 try {
 const context = await browser.newContext({viewport:process.env.TEST_DESKTOP ? {width:1440,height:1000} : {width:390,height:844},timezoneId:'Asia/Kolkata'});
 const state=structuredClone(initialAppState); state.currentUserId='user-vishv';
 const user=state.residents.find(x=>x.id===state.currentUserId);
 const base={...state.posts[0],authorId:'user-aarya',type:'fun',category:'Cricket',status:'Active',visibility:'Public',acceptedUserIds:[],comments:[]};
 state.posts=[{...base,id:'near',title:'Nearby cricket',location:{area:'Wadala',city:'Mumbai',latitude:19.017,longitude:72.858},createdAt:'2026-10-20T10:00:00Z'},
 {...base,id:'far',title:'Far cricket',location:{area:'Andheri',city:'Mumbai',latitude:19.12,longitude:72.85},createdAt:'2026-10-21T10:00:00Z'},
 {...base,id:'ownhelp',title:'Own hidden help',type:'help',authorId:user.id},
 {...base,id:'otherhelp',title:'Other visible help',type:'help',location:{area:'Wadala',city:'Mumbai'}}];
 user.location=state.posts[0].location; state.location=user.location;
 await context.addInitScript(({state,user})=>{
  if(localStorage.getItem('test-seeded'))return;
  localStorage.setItem('test-seeded','true');
  localStorage.setItem('szocial-mvp-state-v2',JSON.stringify(state));
  localStorage.setItem('szocial_auth','true');localStorage.setItem('szocial_user',JSON.stringify(user));
  localStorage.setItem('szocial_users',JSON.stringify([user]));localStorage.setItem('szocial_location',JSON.stringify(user.location));
 },{state,user});
 const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const goto=async path=>{await page.goto((process.env.TEST_BASE_URL||'http://127.0.0.1:3000')+path);};
 await goto('/home'); await page.getByRole('heading',{name:'Nearby cricket',exact:true}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Own hidden help'}).count(),0);
 await page.getByRole('searchbox').fill('  CRICK ');
 assert.equal(await page.locator('article h3').first().innerText(),'Nearby cricket');
 await page.getByRole('combobox').selectOption('newest');
 assert.equal(await page.locator('article h3').first().innerText(),'Far cricket');
 await page.getByRole('button',{name:'Clear search',exact:true}).click();
 await page.getByRole('searchbox').fill('nomatch');await page.getByText('No local posts found').waitFor();
 await goto('/explore');await page.getByRole('heading',{name:'Nearby cricket',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Business',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Events',exact:true}).count(),0);
 await page.getByRole('searchbox').fill(' Andheri ');assert.equal(await page.locator('article h3').first().innerText(),'Far cricket');
 await goto('/help');await page.getByRole('heading',{name:'Other visible help',exact:true}).waitFor();
 assert.equal(await page.getByText('Offer Help',{exact:true}).count(),0);assert.equal(await page.getByText('Own hidden help',{exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:/save|mark as solved/i}).count(),0);
 await goto('/my-posts');await page.getByRole('heading',{name:'Own hidden help',exact:true}).waitFor();
 await goto('/chats?chatId=chat-cricket'); const input=page.getByPlaceholder('Type a message...');await input.waitFor();
 await input.fill('Browser regression message');await page.getByRole('button',{name:'Send',exact:true}).click();
 await page.getByText('Browser regression message',{exact:true}).last().waitFor();
 await page.reload();await page.getByText('Browser regression message',{exact:true}).last().waitFor();
 // Another same-origin tab/account sends a reply; the first tab receives it via storage events.
 const otherUser=state.residents.find(user=>user.id==='user-aarya');
 await page.evaluate(user=>localStorage.setItem('szocial_user',JSON.stringify(user)),otherUser);
 const peer=await context.newPage();await peer.goto((process.env.TEST_BASE_URL||'http://127.0.0.1:3000')+'/chats?chatId=chat-cricket');
 await peer.getByText('Browser regression message',{exact:true}).last().waitFor();
 await peer.getByPlaceholder('Type a message...').fill('Reply from peer tab');
 await peer.getByRole('button',{name:'Send',exact:true}).click();
 await page.getByText('Reply from peer tab',{exact:true}).last().waitFor();
 await peer.close();
 await page.evaluate(user=>localStorage.setItem('szocial_user',JSON.stringify(user)),user);
 page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Block',exact:true}).click();assert.equal(await input.isDisabled(),true);
 await page.reload();await page.getByRole('button',{name:'Unblock',exact:true}).waitFor();assert.equal(await input.isDisabled(),true);
 await page.getByRole('button',{name:'Unblock',exact:true}).click();assert.equal(await input.isEnabled(),true);
 // A failed storage write must keep the unsent draft and avoid fake success.
 await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='szocial-mvp-state-v2')throw new Error('test storage failure');return window.originalSetItem.call(this,key,value);};});
 await input.fill('Keep this unsent draft');await page.getByRole('button',{name:'Send',exact:true}).click();
 assert.equal(await input.inputValue(),'Keep this unsent draft');
 await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});
 // Report the conversation; verify a real local record instead of only a toast.
 await page.getByRole('button',{name:'Report conversation',exact:true}).click();
 await page.getByRole('button',{name:'Submit report',exact:true}).click();
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('szocial-mvp-state-v2')));
 assert.ok(stored.reports.some(r=>r.itemId==='chat-cricket'&&r.reportedBy==='user-vishv'));
 assert.equal(stored.chats.find(c=>c.id==='chat-cricket').messages.filter(m=>m.text==='Browser regression message').length,1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 console.log('PASS: '+(process.env.TEST_DESKTOP?'desktop':'mobile')+' Home/Explore search and sorting, Help exclusions, My Posts, chat send/reload/block/unblock/report, no overflow or runtime errors');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
