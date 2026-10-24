import { NextResponse } from 'next/server';
import { authenticatedClient } from '@/lib/supabase/server';
import { adminSupabase } from '@/lib/supabase/admin';
import { paymentConfiguration,razorpayRequest } from '@/lib/payment-security';
import { sameOrigin } from '@/lib/auth-security';
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid origin'},{status:403});
 try {
  const {client}=await authenticatedClient(),{planId,businessId,idempotencyKey}=await request.json(),{keyId,mode}=paymentConfiguration();
  if(!/^[0-9a-f-]{36}$/i.test(String(idempotencyKey)))throw new Error('A valid idempotency key is required');
  // The database determines amount and checks ownership. Any client amount is ignored.
  const {data:purchase,error}=await client.rpc('reserve_payment',{business:businessId,plan:planId,request_key:idempotencyKey,payment_mode:mode});if(error)throw error;
  if(purchase.status!=='created')throw new Error('This purchase has already been processed');
  let orderId=purchase.razorpay_order_id;
  if(!orderId){
   const admin=adminSupabase();const {data:claimed,error:claimError}=await admin.rpc('claim_payment_order',{payment:purchase.id});if(claimError)throw claimError;
   if(!claimed)return NextResponse.json({error:'Order creation is pending reconciliation. Retry this purchase shortly; do not start a second purchase.'},{status:409});
   const order=await razorpayRequest('orders',{amount:purchase.amount_paise,currency:'INR',receipt:purchase.id,notes:{szocial_payment_id:purchase.id}});
   if(order.amount!==purchase.amount_paise||order.currency!=='INR'||typeof order.id!=='string')throw new Error('Provider returned an unexpected order');
   const {error:saveError}=await admin.from('payments').update({razorpay_order_id:order.id}).eq('id',purchase.id).is('razorpay_order_id',null);if(saveError)throw saveError;orderId=order.id;
  }
  return NextResponse.json({mock:false,orderId,amount:purchase.amount_paise,currency:'INR',keyId},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Order creation failed'},{status:400});}
}
