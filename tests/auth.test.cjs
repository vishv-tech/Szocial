/* eslint-disable @typescript-eslint/no-require-imports */
require('./register.cjs');
const {test,beforeEach}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const original=Module._load,jar=new Map();let calls,signupResult,resendError,providerStatus,complete,roles,user,listener;
const client={auth:{
 signInWithPassword:async()=>({error:null}),
 signUp:async input=>{calls.signup.push(input);if(signupResult.error?.status===429)listener?.(new Response('',{status:429,headers:{'Retry-After':'600'}}));return signupResult;},
 resend:async input=>{calls.resend.push(input);if(resendError?.status===429)listener?.(new Response('',{status:429,headers:{'Retry-After':'300'}}));return {error:resendError};},getUser:async()=>({data:{user},error:null}),
 exchangeCodeForSession:async code=>{calls.exchange.push(code);return {error:code==='expired'?new Error('expired'):null};},
 verifyOtp:async input=>{calls.otp.push(input);return {error:input.token_hash==='expired'?new Error('expired'):null};},
 signInWithOAuth:async input=>{calls.oauth.push(input);return {data:{url:`https://szocial.example.invalid/auth/v1/authorize?provider=${input.provider}`},error:null};},
 resetPasswordForEmail:async()=>({error:null})
},from:table=>({select:()=>({eq:()=>({single:async()=>({data:{onboarding_complete:complete},error:null}),then:resolve=>Promise.resolve({data:table==='account_roles'?roles:[],error:null}).then(resolve)})})})};
Module._load=function(name,...rest){
 if(name==='server-only')return {};
 if(name==='next/headers')return {cookies:async()=>({get:name=>jar.has(name)?{value:jar.get(name)}:undefined,set:(name,value)=>jar.set(name,value)})};
 if(name==='@/lib/supabase/server')return {serverSupabase:async options=>{listener=options?.onAuthResponse;return client;}};
 if(name==='@/lib/supabase/config')return {supabaseConfig:()=>({url:'https://szocial.example.invalid',key:'test-only-publishable'})};
 if(name==='@/lib/oauth-providers')return {providerAvailability:async()=>providerStatus};
 return original.call(this,name,...rest);
};
const route=require('../app/api/auth/[action]/route.ts'),callback=require('../app/auth/callback/route.ts'),confirm=require('../app/auth/confirm/route.ts'),oauth=require('../app/api/auth/oauth/route.ts'),pending=require('../lib/auth-pending.ts');Module._load=original;
const {maskedEmail,callbackIntent,retrySeconds}=require('../lib/auth-flow.ts');
beforeEach(()=>{jar.clear();calls={signup:[],resend:[],exchange:[],otp:[],oauth:[]};signupResult={data:{session:null,user:{id:'test-user'}},error:null};resendError=null;providerStatus={google:'enabled',facebook:'enabled'};complete=false;roles=[{role:'resident'}];user={id:'test-user',user_metadata:{role:'admin'}};});
let serial=0;const email=()=>`signup-${++serial}@example.invalid`;
const request=body=>new Request('https://app.test/api/auth/signup',{method:'POST',headers:{Origin:'https://app.test','Content-Type':'application/json'},body:JSON.stringify(body)});
const post=(action,body)=>route.POST(request(body),{params:Promise.resolve({action})});
test('accepted signup returns confirmation outcome; credentials never enter pending cookie or metadata',async()=>{
 const address=email(),response=await post('signup',{email:address,password:'test-only-password',name:'Resident',business:true,profilePhoto:'data:ignored'});
 assert.equal(response.status,200);assert.equal((await response.json()).outcome,'confirmation_required');assert.equal(calls.signup.length,1);
 assert.deepEqual(calls.signup[0].options.data,{full_name:'Resident'});assert.ok(calls.signup[0].options.emailRedirectTo.includes(encodeURIComponent('/onboarding?business=1')));
 assert.ok([...jar.values()].every(value=>!value.includes(address)&&!value.includes('test-only-password')&&!value.includes('data:ignored')));
 const repeat=await post('signup',{email:address,password:'test-only-password'});assert.equal((await repeat.json()).outcome,'confirmation_required');assert.equal(calls.signup.length,1);
});
test('session-available signup is distinct from confirmation and routes to onboarding',async()=>{signupResult={data:{session:{},user},error:null};const response=await post('signup',{email:email(),password:'test-only-password'});assert.equal((await response.json()).outcome,'authenticated');});
test('rejected signup never creates an accepted pending confirmation',async()=>{signupResult={data:{session:null},error:{status:400,message:'Signup rejected'}};const response=await post('signup',{email:email(),password:'test-only-password'});assert.equal(response.status,400);assert.equal((await pending.pendingSignup()).accepted,false);});
test('rate limits preserve HTTP 429 and provider Retry-After',async()=>{signupResult={data:{session:null},error:{status:429,code:'over_email_send_rate_limit'}};const response=await post('signup',{email:email(),password:'test-only-password'});assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'600');assert.equal((await response.json()).retryAfter,600);});
test('uncertain signup is not treated as accepted and cannot immediately issue another backend signup',async()=>{
 const address=email();signupResult={data:{session:null},error:{status:503,message:'network'}};assert.equal((await post('signup',{email:address,password:'test-only-password'})).status,503);
 const repeat=await post('signup',{email:address,password:'test-only-password'});assert.equal(repeat.status,429);assert.equal(calls.signup.length,1);
});
test('resend requires accepted flow and respects encrypted server cooldown',async()=>{
 assert.equal((await post('resend',{})).status,400);const address=email();await post('signup',{email:address,password:'test-only-password'});
 assert.equal((await post('resend',{})).status,429);assert.equal(calls.resend.length,0);
 await pending.savePendingSignup({email:email(),business:true,accepted:true,retryAt:0},request({}));
 const response=await post('resend',{});assert.equal(response.status,200);assert.equal(calls.resend.length,1);assert.equal((await post('resend',{})).status,429);
});
test('tampered pending cookies are rejected',async()=>{await pending.savePendingSignup({email:email(),business:false,accepted:true,retryAt:0},request({}));for(const [key,value] of jar)jar.set(key,'broken'+value);assert.equal(await pending.pendingSignup(),null);});
for(const provider of ['google','facebook'])test(`${provider} OAuth sets PKCE callback and business intent without granting a role`,async()=>{
 const response=await oauth.POST(request({provider,business:true}));assert.equal(response.status,200);assert.equal(calls.oauth[0].provider,provider);assert.ok(calls.oauth[0].options.redirectTo.includes(encodeURIComponent('/onboarding?business=1')));assert.equal(calls.oauth[0].options.skipBrowserRedirect,true);assert.equal(calls.oauth[0].options.scopes,provider==='facebook'?'email':undefined);
});
test('disabled and unknown providers fail in the application before redirect',async()=>{
 for(const status of ['disabled','unknown']){providerStatus={google:status,facebook:status};assert.equal((await oauth.POST(request({provider:'google'}))).status,503);}assert.equal(calls.oauth.length,0);
});
test('callback exchanges code, verifies session and sends new residents to onboarding',async()=>{const response=await callback.GET(new Request('https://app.test/auth/callback?code=valid'));assert.equal(new URL(response.headers.get('location')).pathname,'/onboarding');assert.deepEqual(calls.exchange,['valid']);});
test('callback directs existing accounts using database roles and onboarding state',async()=>{
 complete=true;assert.equal(new URL((await callback.GET(new Request('https://app.test/auth/callback?code=valid'))).headers.get('location')).pathname,'/home');roles=[{role:'business'}];assert.equal(new URL((await callback.GET(new Request('https://app.test/auth/callback?code=valid'))).headers.get('location')).pathname,'/business/dashboard');
 roles=[{role:'resident'}];const response=await callback.GET(new Request('https://app.test/auth/callback?code=valid&next=%2Fonboarding%3Fbusiness%3D1'));assert.equal(new URL(response.headers.get('location')).search,'?business=1');
});
test('callback failure and cancellation return friendly recovery routes',async()=>{
 for(const query of ['code=expired','error=access_denied',''])assert.equal(new URL((await callback.GET(new Request('https://app.test/auth/callback?'+query))).headers.get('location')).pathname,'/auth/error');
 user=null;assert.equal(new URL((await callback.GET(new Request('https://app.test/auth/callback?code=valid'))).headers.get('location')).pathname,'/auth/error');
});
test('token-hash confirmation preserves business intent and recovery links',async()=>{
 const response=await confirm.GET(new Request('https://app.test/auth/confirm?token_hash=valid&type=signup&intent=business'));assert.equal(new URL(response.headers.get('location')).search,'?business=1');assert.equal(calls.otp[0].type,'signup');
 assert.equal(new URL((await confirm.GET(new Request('https://app.test/auth/confirm?token_hash=valid&type=recovery'))).headers.get('location')).pathname,'/reset-password');
 assert.equal(new URL((await confirm.GET(new Request('https://app.test/auth/confirm?token_hash=expired&type=recovery'))).headers.get('location')).pathname,'/auth/error');
});
test('intent parsing accepts only same-origin nested redirects; email is masked',()=>{
 assert.equal(callbackIntent(new URL('https://app.test/auth/confirm?next=https%3A%2F%2Fevil.test%2F%3Fbusiness%3D1')),false);
 assert.equal(callbackIntent(new URL('https://app.test/auth/confirm?redirect_to='+encodeURIComponent('https://app.test/auth/callback?next='+encodeURIComponent('/onboarding?business=1')))),true);
 assert.equal(maskedEmail('resident@example.invalid'),'r***@example.invalid');assert.equal(retrySeconds('600'),600);assert.ok(retrySeconds(null)>=120);
});

test('resend provider rejection preserves cooldown and never reports delivery',async()=>{await pending.savePendingSignup({email:email(),business:false,accepted:true,retryAt:0},request({}));resendError={status:429,code:'over_email_send_rate_limit'};const response=await post('resend',{});assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'300');assert.ok((await pending.pendingSignup()).retryAt>Date.now()+299000);});
test('missing signup result is uncertain, not a confirmation success',async()=>{signupResult={data:{user:null,session:null},error:null};const response=await post('signup',{email:email(),password:'test-only-password'});assert.equal(response.status,503);assert.equal((await pending.pendingSignup()).accepted,false);});
test('successful confirmation clears the pending-email state',async()=>{await pending.savePendingSignup({email:email(),business:false,accepted:true,retryAt:0},request({}));await confirm.GET(new Request('https://app.test/auth/confirm?token_hash=valid&type=email'));assert.equal(await pending.pendingSignup(),null);});

test('email login sends incomplete profiles to onboarding and completed residents Home',async()=>{const first=await post('login',{email:email(),password:'test-only-password'});assert.equal((await first.json()).next,'/onboarding');complete=true;assert.equal((await (await post('login',{email:email(),password:'test-only-password'})).json()).next,'/home');});
test('business email login preserves setup intent without granting a business role',async()=>{complete=true;const response=await post('login',{email:email(),password:'test-only-password',business:true});assert.equal((await response.json()).next,'/onboarding?business=1');assert.deepEqual(roles,[{role:'resident'}]);});
