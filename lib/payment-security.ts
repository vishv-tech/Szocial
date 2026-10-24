import { createHmac, timingSafeEqual } from 'node:crypto';
export function validHmac(message:string,signature:unknown,secret:string){
 if(typeof signature!=='string'||!/^[a-f0-9]{64}$/i.test(signature))return false;
 const expected=createHmac('sha256',secret).update(message).digest();return timingSafeEqual(expected,Buffer.from(signature,'hex'));
}
export function paymentConfiguration(){
 const keyId=process.env.RAZORPAY_KEY_ID,secret=process.env.RAZORPAY_KEY_SECRET,mode=process.env.RAZORPAY_MODE;
 if(!keyId||!secret||!['test','live'].includes(mode??'')||!keyId.startsWith(mode==='live'?'rzp_live_':'rzp_test_'))throw new Error('Razorpay is not configured for the selected payment environment.');
 return {keyId,secret,mode:mode as 'test'|'live'};
}
export async function razorpayRequest(path:string,body?:unknown){
 const {keyId,secret}=paymentConfiguration();
 const response=await fetch(`https://api.razorpay.com/v1/${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Basic ${Buffer.from(`${keyId}:${secret}`).toString('base64')}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000),cache:'no-store'});
 if(!response.ok)throw new Error('Payment provider request failed');
 return response.json();
}
