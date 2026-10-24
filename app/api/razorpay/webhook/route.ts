import { NextResponse } from 'next/server';
import { validHmac,paymentConfiguration } from '@/lib/payment-security';
import { adminSupabase } from '@/lib/supabase/admin';
export async function POST(request:Request){
 try {
  const secret=process.env.RAZORPAY_WEBHOOK_SECRET;if(!secret)throw new Error('Webhook is not configured');
  const raw=await request.text();if(raw.length>1000000||!validHmac(raw,request.headers.get('x-razorpay-signature'),secret))return NextResponse.json({error:'Invalid signature'},{status:401});
  const event=JSON.parse(raw),{mode}=paymentConfiguration();
  if(!['payment.captured','refund.processed'].includes(event.event))return NextResponse.json({received:true});
  const payment=event.payload?.payment?.entity;
  if(!payment?.id||!payment.order_id||payment.currency!=='INR')throw new Error('Invalid payment event');
  if(event.event==='payment.captured'&&(payment.status!=='captured'||payment.captured!==true))throw new Error('Payment not captured');
  const admin=adminSupabase();
  // Recover an uncertain create-order response using the receipt bound to our reserved purchase.
  const internalId=payment.notes?.szocial_payment_id;
  if(internalId){const {data:purchase}=await admin.from('payments').select('*').eq('id',internalId).eq('mode',mode).single();
   if(purchase&&purchase.amount_paise===payment.amount&&!purchase.razorpay_order_id)await admin.from('payments').update({razorpay_order_id:payment.order_id}).eq('id',purchase.id).is('razorpay_order_id',null);
  }
  const {error}=await admin.rpc('finalize_payment',{order_id:payment.order_id,provider_payment_id:payment.id,amount:payment.amount,payment_mode:mode,refund:event.event==='refund.processed'});if(error)throw error;
  return NextResponse.json({received:true});
 }catch{return NextResponse.json({error:'Webhook reconciliation failed'},{status:400});}
}
