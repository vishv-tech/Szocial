/* eslint-disable @typescript-eslint/no-require-imports */
require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),{createHmac}=require('node:crypto');
const original=Module._load;
let reconciled=[];
Module._load=function(name,...rest){
 if(name==='@/lib/payment-reconciliation')return {reconcileProviderPayment:async id=>{reconciled.push(id);}};
 return original.call(this,name,...rest);
};
const webhook=require('../app/api/razorpay/webhook/route.ts');Module._load=original;
function request(event,signature){const raw=JSON.stringify(event);return new Request('https://app.test/api/razorpay/webhook',{method:'POST',body:raw,headers:{'x-razorpay-signature':signature??createHmac('sha256','test-webhook').update(raw).digest('hex')}});}
test('refund webhooks use refund.entity.payment_id and ignore spoofed payment amounts',async()=>{
 const prior=process.env.RAZORPAY_WEBHOOK_SECRET;process.env.RAZORPAY_WEBHOOK_SECRET='test-webhook';reconciled=[];
 try{const response=await webhook.POST(request({event:'refund.processed',payload:{refund:{entity:{payment_id:'pay_verified'}},payment:{entity:{id:'pay_spoofed',amount:1}}}}));assert.equal(response.status,200);assert.deepEqual(reconciled,['pay_verified']);}finally{if(prior===undefined)delete process.env.RAZORPAY_WEBHOOK_SECRET;else process.env.RAZORPAY_WEBHOOK_SECRET=prior;}
});
test('forged webhook signatures cannot invoke reconciliation',async()=>{
 const prior=process.env.RAZORPAY_WEBHOOK_SECRET;process.env.RAZORPAY_WEBHOOK_SECRET='test-webhook';reconciled=[];
 try{assert.equal((await webhook.POST(request({event:'payment.captured',payload:{payment:{entity:{id:'pay_fake'}}}},'0'.repeat(64)))).status,401);assert.deepEqual(reconciled,[]);}finally{if(prior===undefined)delete process.env.RAZORPAY_WEBHOOK_SECRET;else process.env.RAZORPAY_WEBHOOK_SECRET=prior;}
});
