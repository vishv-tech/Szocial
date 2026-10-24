/* eslint-disable @typescript-eslint/no-require-imports -- Local Auth double; real browser image decoding/canvas. */
const {chromium}=require('playwright'),{spawn}=require('node:child_process'),{createServer}=require('node:http'),fs=require('node:fs'),assert=require('node:assert/strict'),sharp=require('sharp');
let server,app,browser,log,signupCount=0,resendCount=0,signupMode='pending';let emails=[];
const base='http://localhost:3011',authBase='http://127.0.0.1:54330';
const sessionUser={id:'55555555-5555-4555-8555-555555555555',aud:'authenticated',role:'authenticated',email:'authenticated@example.invalid',email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{}};
const sessionJwt=[{alg:'HS256',typ:'JWT'},{sub:sessionUser.id,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated',role:'authenticated'},'test-only-signature'].map((value,i)=>i===2?value:Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{try{
 server=createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');
  if(req.url.startsWith('/auth/v1/settings'))return res.end(JSON.stringify({external:{google:false,facebook:false,email:true}}));
  if(req.url.startsWith('/auth/v1/signup')){signupCount++;let raw='';for await(const chunk of req)raw+=chunk;emails.push(JSON.parse(raw).email);await delay(350);
   if(signupMode==='rate'){res.statusCode=429;res.setHeader('Retry-After','240');return res.end(JSON.stringify({code:'over_email_send_rate_limit',msg:'Too many emails'}));}
   if(signupMode==='reject'){res.statusCode=400;return res.end(JSON.stringify({code:'email_address_invalid',msg:'Signup rejected by test provider'}));}
   if(signupMode==='authenticated'){sessionUser.email=JSON.parse(raw).email;return res.end(JSON.stringify({access_token:sessionJwt,refresh_token:'test-only-refresh',token_type:'bearer',expires_in:3600,user:sessionUser}));}
   return res.end(JSON.stringify({id:'test-user',email:JSON.parse(raw).email,identities:[],created_at:new Date().toISOString()}));
  }
  if(req.url.startsWith('/auth/v1/resend')){resendCount++;return res.end('{}');}
  if(signupMode==='authenticated'){
   if(req.url.startsWith('/auth/v1/user'))return res.end(JSON.stringify(sessionUser));
   const single=req.headers.accept?.includes('object'),respond=value=>res.end(JSON.stringify(single?value:[value]));
   if(req.url.startsWith('/rest/v1/profiles'))return respond({id:sessionUser.id,full_name:'Authenticated resident',account_status:'Active',created_at:sessionUser.created_at});
   if(req.url.startsWith('/rest/v1/profile_private'))return respond({user_id:sessionUser.id,onboarding_complete:false,location:{area:'',city:''}});
   if(req.url.startsWith('/rest/v1/account_roles'))return res.end(JSON.stringify([{user_id:sessionUser.id,role:'resident'}]));
  }
  res.end('[]');
 });await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(54330,'127.0.0.1',resolve);});
 log=fs.openSync('/tmp/szocial-auth-browser-server.log','w');app=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3011'],{stdio:['ignore',log,log],env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:authBase,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'test-only-public',SUPABASE_SECRET_KEY:'',AUTH_RATE_LIMIT_SECRET:'test-only-cookie-encryption'}});
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/signup')).ok){ready=true;break;}}catch{}await delay(400);}assert.ok(ready);
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const fixtures={};for(const format of ['png','jpeg','webp'])fixtures[format]=await sharp({create:{width:640,height:360,channels:3,background:'#e34c26'}}).composite([{input:await sharp({create:{width:100,height:360,channels:3,background:'#209bcc'}}).png().toBuffer(),left:0,top:0}])[format]().toBuffer();
 const visit=async(page,path)=>{if(page.url()==='about:blank')await page.goto(base+path);else await Promise.all([page.waitForEvent('load'),page.evaluate(path=>window.location.assign(path),path)]);await page.waitForURL('**'+path);};
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await visit(page,'/signup');
  await page.getByRole('button',{name:'Continue with Google',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Continue with Google',exact:true}).isDisabled(),true);
  await page.getByText(/Google sign-in is not configured/).waitFor();assert.equal(await page.getByRole('button',{name:'Continue with Facebook',exact:true}).isDisabled(),true);
  for(const format of ['png','jpeg','webp']){
   const file=page.locator('input[type=file]');await file.setInputFiles({name:'valid.'+format,mimeType:'image/'+format,buffer:fixtures[format]});
   const use=page.getByRole('button',{name:'Use photo',exact:true});await use.waitFor();await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Use photo')?.disabled);
   const image=page.getByRole('application',{name:'Profile photo crop area'}).locator('img');assert.ok(await image.evaluate(img=>img.complete&&img.naturalWidth>0&&img.getBoundingClientRect().width>0));
   assert.ok(await page.getByAltText('Cropped profile preview').evaluate(img=>img.complete&&img.naturalHeight>0));
   if(format==='png')await page.screenshot({path:`/tmp/szocial-crop-${viewport.width}.png`});
   const zoom=page.getByRole('slider',{name:'Zoom profile photo'});await zoom.fill('2');assert.equal(await zoom.inputValue(),'2');
   const crop=page.getByRole('application',{name:'Profile photo crop area'}),bounds=await crop.boundingBox();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width/2+35,bounds.y+bounds.height/2+20,{steps:4});await page.mouse.up();
   const moved=await image.evaluate(img=>img.parentElement.style.transform);assert.notEqual(moved,'translate3d(0px, 0px, 0px)');
   await page.getByRole('button',{name:'Reset',exact:true}).click();assert.equal(await zoom.inputValue(),'1');
   await zoom.fill('2');await crop.focus();await page.keyboard.press('ArrowLeft');assert.ok((await image.evaluate(img=>img.parentElement.style.transform)).includes('-10px'));
   await use.click();await use.waitFor({state:'detached'});const preview=page.getByAltText('Selected profile preview',{exact:true});
   const source=await preview.getAttribute('src');assert.ok(source.startsWith('data:image/jpeg;base64,'));const metadata=await sharp(Buffer.from(source.split(',')[1],'base64')).metadata();assert.equal(metadata.width,512);assert.equal(metadata.height,512);const pixel=await sharp(Buffer.from(source.split(',')[1],'base64')).extract({left:256,top:256,width:1,height:1}).raw().toBuffer();assert.ok(pixel[0]>150&&pixel[1]<130&&pixel[2]<130,'Crop output contains the source photo, not a blank canvas');
   // Cached image reselection and cancel/reopen exercise the former reset/load race.
   await file.setInputFiles({name:'again.'+format,mimeType:'image/'+format,buffer:fixtures[format]});await page.getByRole('button',{name:'Cancel',exact:true}).click();
  }
  await page.locator('input[type=file]').setInputFiles({name:'corrupt.png',mimeType:'image/png',buffer:Buffer.from('not an image')});await page.getByRole('alert').filter({hasText:/Could not decode/}).waitFor();assert.equal(await page.getByRole('button',{name:'Use photo',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({name:'unsupported.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});await page.getByText('Please select a valid image file.',{exact:true}).waitFor();
  await page.locator('input[type=file]').setInputFiles({name:'oversized.png',mimeType:'image/png',buffer:Buffer.alloc(2*1024*1024+1)});await page.getByText('Image must be under 2 MB.',{exact:true}).waitFor();
  const wide=await sharp({create:{width:10001,height:1,channels:3,background:'red'}}).png().toBuffer();await page.locator('input[type=file]').setInputFiles({name:'too-wide.png',mimeType:'image/png',buffer:wide});await page.getByRole('alert').filter({hasText:/dimensions are too large/}).waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.deepEqual(errors,[]);console.log(`PASS real PNG/JPEG/WebP crop, preview, zoom, drag, keyboard, reset, output, corrupt and reselect (${viewport.width}px)`);await context.close();
 }
 const context=await browser.newContext(),page=await context.newPage();
 const fillSignup=async(address,business=false)=>{await visit(page,business?'/business/signup':'/signup');await page.getByLabel(business?'Owner name *':'Full name *',{exact:true}).fill('Signup Tester');await page.getByLabel('Email *',{exact:true}).fill(address);await page.getByLabel('Password *',{exact:true}).fill('test-only-password');
  if(business){await page.getByLabel('Business name *',{exact:true}).fill('Test cafe');await page.getByLabel('Business address *',{exact:true}).fill('Test street');}
  else{await page.getByRole('button',{name:'Enter Location Manually',exact:true}).click();await page.getByLabel('City *',{exact:true}).fill('Mumbai');await page.getByLabel('Area *',{exact:true}).fill('Wadala');}
 };
 await fillSignup('pending@example.invalid');const before=signupCount;
 await page.getByRole('button',{name:'Signup',exact:true}).click();await page.getByRole('button',{name:'Creating account...',exact:true}).waitFor();
 await page.locator('form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});await page.keyboard.press('Enter');await page.waitForURL('**/check-email');assert.equal(signupCount-before,1);
 await page.getByText('p***@example.invalid',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:/Resend available/}).isDisabled(),true);
 const denied=await page.request.post(base+'/api/auth/resend',{data:{},headers:{Origin:base}});assert.equal(denied.status(),429);assert.equal(resendCount,0);
 await page.reload();await page.getByText('p***@example.invalid',{exact:true}).waitFor();
 // A fresh tab receives the same encrypted pending state; no signup request is repeated.
 const repeat=await page.request.post(base+'/api/auth/signup',{data:{email:'pending@example.invalid',password:'test-only-password'},headers:{Origin:base}});assert.equal(repeat.status(),200);assert.equal(signupCount-before,1);
 console.log('PASS one signup across rapid submit/Enter, immediate loading, confirmation page, masked email and resend cooldown');
 let uiResends=0;await page.route('**/api/auth/confirmation',route=>route.fulfill({json:{pending:true,email:'p***@example.invalid',business:false,retryAfter:0}}));
 await page.route('**/api/auth/resend',async route=>{uiResends++;await delay(250);await route.fulfill({status:429,headers:{'Retry-After':'180'},json:{outcome:'rate_limited',error:'Wait before resending.',retryAfter:180}});});
 await page.reload();const resendButton=page.getByRole('button',{name:'Resend verification email',exact:true});await resendButton.waitFor();await resendButton.click();await page.getByRole('button',{name:'Requesting email…',exact:true}).waitFor();await page.getByRole('button',{name:/Resend available in 18\d/}).waitFor();assert.equal(uiResends,1);await page.unroute('**/api/auth/confirmation');await page.unroute('**/api/auth/resend');console.log('PASS resend UI loading and HTTP 429 cooldown');

 signupMode='reject';await fillSignup('rejected@example.invalid');await page.getByRole('button',{name:'Signup',exact:true}).click();await page.getByRole('alert').filter({hasText:/Signup rejected/}).waitFor();assert.ok(page.url().endsWith('/signup'));
 signupMode='rate';await fillSignup('limited@example.invalid');await page.getByRole('button',{name:'Signup',exact:true}).click();await page.getByRole('button',{name:/Try again in 24\d/}).waitFor();assert.ok(page.url().endsWith('/signup'));
 let uncertainRequests=0;await page.route('**/api/auth/signup',route=>{uncertainRequests++;return route.abort();});await fillSignup('uncertain@example.invalid');await page.getByRole('button',{name:'Signup',exact:true}).click();await page.getByRole('alert').filter({hasText:/could not confirm/}).waitFor();assert.ok(page.url().endsWith('/signup'));assert.equal(await page.getByRole('button',{name:'Signup',exact:true}).isDisabled(),true);await page.locator('form').evaluate(form=>form.requestSubmit());assert.equal(uncertainRequests,1);await page.unroute('**/api/auth/signup');console.log('PASS uncertain network result blocks automatic signup retries');
 signupMode='pending';await fillSignup('business@example.invalid',true);await page.getByRole('button',{name:'Create Business Account',exact:true}).click();await page.waitForURL('**/check-email');await page.getByRole('link',{name:'Return to login',exact:true}).waitFor();assert.ok((await page.getByRole('link',{name:'Return to login',exact:true}).getAttribute('href')).includes('/business/login'));assert.equal(emails.filter(email=>email==='business@example.invalid').length,1);
 console.log('PASS rejection, HTTP 429, provider cooldown and business confirmation intent');
 for(const path of ['/login','/signup','/business/login','/business/signup']){await visit(page,path);await page.getByText(/Google sign-in is not configured/).waitFor();assert.ok(page.url().endsWith(path));}console.log('PASS disabled social providers on all four auth screens');
 // Session-available signup must replace an older anonymous bootstrap request,
 // preserve its photo draft, and ignore a delayed 401 from before authentication.
 signupMode='authenticated';let oldCoreStarted=false,releaseOldCore;const oldCore=new Promise(resolve=>{releaseOldCore=resolve;});
 await page.route('**/api/app*',async route=>{if(route.request().method()==='GET'&&!oldCoreStarted){oldCoreStarted=true;await oldCore;try{await route.fulfill({status:401,json:{error:'Old anonymous request'}});}catch{}return;}await route.continue();});
 await fillSignup('authenticated@example.invalid');await page.locator('input[type=file]').setInputFiles({name:'authenticated.png',mimeType:'image/png',buffer:fixtures.png});const use=page.getByRole('button',{name:'Use photo',exact:true});await use.waitFor();await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Use photo')?.disabled);await use.click();assert.equal(oldCoreStarted,true);
 await page.getByRole('button',{name:'Signup',exact:true}).click();await page.waitForURL('**/onboarding');await page.getByRole('heading',{name:'Complete your profile',exact:true}).waitFor();await page.waitForFunction(()=>Array.from(document.querySelectorAll('input')).some(input=>input.value==='Signup Tester'));assert.equal(await page.getByLabel('City',{exact:true}).inputValue(),'Mumbai');assert.ok((await page.getByAltText('Selected profile photo',{exact:true}).getAttribute('src')).startsWith('data:image/jpeg'));
 releaseOldCore();await delay(250);assert.equal(await page.getByLabel('Full name',{exact:true}).inputValue(),'Signup Tester');console.log('PASS authenticated signup replaces anonymous requests and preserves the cropped photo/setup draft');
 await context.close();
 }finally{if(browser)await browser.close();if(app)app.kill('SIGTERM');if(server)await new Promise(resolve=>server.close(resolve));if(log)fs.closeSync(log);}
})().catch(error=>{console.error(error);process.exitCode=1;});
