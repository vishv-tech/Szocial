/* eslint-disable @typescript-eslint/no-require-imports */
require('./register.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {boundedBody,boundedJson}=require('../lib/request-body.ts');
const {safeNext,sameOrigin}=require('../lib/auth-security.ts');
const {validHmac,paymentConfiguration}=require('../lib/payment-security.ts');
const {loadUserLocation,saveUserLocation,clearUserLocation}=require('../lib/location.ts');
test('chunked bodies enforce actual byte limits without trusting Content-Length',async()=>{
 const request=new Request('https://app.test/upload',{method:'POST',duplex:'half',body:new ReadableStream({start(c){c.enqueue(new Uint8Array(4));c.enqueue(new Uint8Array(4));c.close();}})});
 await assert.rejects(boundedBody(request,7),/too large/);
 assert.equal((await boundedBody(new Request('https://app.test/upload',{method:'POST',body:'1234'}),4)).length,4);
 await assert.rejects(boundedJson(new Request('https://app.test',{method:'POST',body:'not json'})),SyntaxError);
});
test('redirects and cross-origin mutations cannot escape the application',()=>{
 for(const value of ['//evil.test','/\\evil.test','https://evil.test','/auth/callback','/\r\nevil'])assert.equal(safeNext(value),'/home');
 assert.equal(safeNext('/chats?chatId=valid'),'/chats?chatId=valid');
 assert.equal(sameOrigin(new Request('https://app.test/api',{headers:{Origin:'https://evil.test'}})),false);
});
test('Razorpay HMAC rejects forged, malformed and altered payloads',()=>{
 const message='order_1|pay_1',secret='test-only-secret',signature=createHmac('sha256',secret).update(message).digest('hex');
 assert.ok(validHmac(message,signature,secret));for(const invalid of [null,'',signature.slice(1),'0'.repeat(64)])assert.equal(validHmac(message,invalid,secret),false);
 assert.equal(validHmac(message+'changed',signature,secret),false);
});
test('payment environment cannot mix a live key into test mode',()=>{
 const previous=Object.fromEntries(['RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET','RAZORPAY_MODE'].map(k=>[k,process.env[k]]));
 try{process.env.RAZORPAY_KEY_ID='rzp_live_fake';process.env.RAZORPAY_KEY_SECRET='fake';process.env.RAZORPAY_MODE='test';assert.throws(paymentConfiguration,/not configured/);}finally{for(const [k,v] of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test('precise location preferences stay out of browser persistence',()=>{
 const calls=[];global.window={localStorage:{removeItem:key=>calls.push(key),setItem:()=>assert.fail('Must not persist GPS')}};
 try{const location={area:'Test',city:'Mumbai',latitude:19.01234567,longitude:72.81234567,source:'gps'};saveUserLocation(location);assert.equal(loadUserLocation().latitude,location.latitude);assert.ok(calls.length);clearUserLocation();assert.equal(loadUserLocation(),null);}finally{delete global.window;}
});
test('legacy credentials are redacted while post exports remain available',()=>{
 const {retireLegacyCredentials,exportLegacyOwnPosts}=require('../lib/resident-auth.ts');
 const values=new Map([['szocial_auth','true'],['szocial_user',JSON.stringify({id:'legacy-a',email:'verified@example.invalid',password:'old-test-password'})],['szocial_users',JSON.stringify([{password:'old-test-password'}])],['szocial-mvp-state-v2',JSON.stringify({residents:[{password:'old-test-password'}],posts:[{authorId:'legacy-a',title:'Keep post',type:'fun'}]})]]);
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};global.window={localStorage:storage};global.localStorage=storage;
 try{retireLegacyCredentials();assert.equal(values.has('szocial_auth'),false);assert.ok([...values.values()].every(value=>!value.includes('old-test-password')));assert.equal(exportLegacyOwnPosts('verified@example.invalid')[0].title,'Keep post');}finally{delete global.window;delete global.localStorage;}
});
