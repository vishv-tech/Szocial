/* eslint-disable @typescript-eslint/no-require-imports */
require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),sharp=require('sharp');
const original=Module._load;let actor='owner',entityOwner='owner',uploaded,record;
Module._load=function(name,...rest){
 if(name==='sharp')return {default:sharp};
 if(name==='@/lib/supabase/server')return {authenticatedClient:async()=>{if(!actor)throw new Error('Authentication required');return {user:{id:actor},client:{from:()=>({select:()=>({eq:()=>({single:async()=>({data:{owner_id:entityOwner}})})})})}};}};
 if(name==='@/lib/supabase/admin')return {adminSupabase:()=>({storage:{from:()=>({upload:async(path,bytes)=>{uploaded=bytes;return {data:{path}};},remove:async()=>({})})},from:()=>({insert:async row=>{record=row;return {};}})})};
 return original.call(this,name,...rest);
};
const uploads=require('../app/api/uploads/route.ts');Module._load=original;
async function imageRequest(bytes,scope='avatar',type='image/png'){
 const form=new FormData();form.set('file',new File([bytes],'test.png',{type}));form.set('scope',scope);form.set('entityId','owned-entity');return new Request('https://app.test/api/uploads',{method:'POST',body:form,headers:{Origin:'https://app.test'}});
}
test('uploads decode/re-encode images and record actor-owned random storage paths',async()=>{
 actor='owner';entityOwner='owner';const input=await sharp({create:{width:32,height:32,channels:3,background:'red'}}).png().toBuffer();const response=await uploads.POST(await imageRequest(input));assert.equal(response.status,200);
 assert.equal((await sharp(uploaded).metadata()).format,'webp');assert.equal(record.owner_id,'owner');assert.ok(record.path.startsWith('owner/profile/'));assert.equal(record.scope,'avatar');assert.equal(record.entity_id,null);
});
test('SVG or malformed image bytes cannot enter Storage',async()=>{const response=await uploads.POST(await imageRequest(Buffer.from('<svg/>'),'avatar','image/svg+xml'));assert.equal(response.status,400);});
test('business image upload requires backend ownership',async()=>{actor='owner';entityOwner='other';const response=await uploads.POST(await imageRequest(Buffer.from('unused'),'business'));assert.equal(response.status,400);assert.match((await response.json()).error,/Not the owner/);entityOwner='owner';});
test('anonymous uploads and foreign origins are rejected',async()=>{
 actor='';assert.equal((await uploads.POST(await imageRequest(Buffer.from('unused')))).status,400);actor='owner';
 assert.equal((await uploads.POST(new Request('https://app.test/api/uploads',{method:'POST',headers:{Origin:'https://foreign.test'}}))).status,403);
});
