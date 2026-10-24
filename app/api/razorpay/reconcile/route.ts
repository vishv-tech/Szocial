import { NextResponse } from 'next/server';
import { authenticatedClient } from '@/lib/supabase/server';
import { adminSupabase } from '@/lib/supabase/admin';
import { sameOrigin } from '@/lib/auth-security';
import { boundedJson } from '@/lib/request-body';
import { paymentConfiguration,razorpayRequest } from '@/lib/payment-security';
import { reconcileProviderPayment } from '@/lib/payment-reconciliation';
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid origin'},{status:403});
 try{
  const {client}=await authenticatedClient(),{id}=await boundedJson(request),{mode}=paymentConfiguration();
  // RLS permits the owner or a protected administrator role to select this purchase.
  const {data:purchase}=await client.from('payments').select('*').eq('id',id).eq('mode',mode).single();
  if(!purchase)throw new Error('Purchase unavailable');
  let orderId=purchase.razorpay_order_id;
  if(!orderId){
   const list=await razorpayRequest(`orders?receipt=${encodeURIComponent(purchase.id)}&count=100`);
   const matches=(list.items??[]).filter((order:{receipt:string;amount:number;currency:string})=>order.receipt===purchase.id&&order.amount===purchase.amount_paise&&order.currency==='INR');
   if(matches.length!==1)throw new Error('Order is still uncertain. Contact support; do not create another purchase.');
   orderId=matches[0].id;
   const {error}=await adminSupabase().from('payments').update({razorpay_order_id:orderId}).eq('id',purchase.id).is('razorpay_order_id',null);if(error)throw error;
  }
  const list=await razorpayRequest(`orders/${encodeURIComponent(orderId)}/payments`);
  const payment=(list.items??[]).find((p:{status:string;captured:boolean})=>p.captured&&['captured','refunded'].includes(p.status));
  if(payment)await reconcileProviderPayment(payment.id);
  return NextResponse.json({success:true,status:payment?'reconciled':'awaiting_payment'},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Reconciliation failed'},{status:409});}
}
