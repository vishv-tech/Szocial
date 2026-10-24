import { NextResponse } from 'next/server';
import { validHmac } from '@/lib/payment-security';
import { boundedBody } from '@/lib/request-body';
import { reconcileProviderPayment } from '@/lib/payment-reconciliation';
export async function POST(request:Request){
 try{
  const secret=process.env.RAZORPAY_WEBHOOK_SECRET;if(!secret)throw new Error('Webhook is not configured');
  const raw=new TextDecoder().decode(await boundedBody(request,1_000_000));
  if(!validHmac(raw,request.headers.get('x-razorpay-signature'),secret))return NextResponse.json({error:'Invalid signature'},{status:401});
  const event=JSON.parse(raw);
  if(!['payment.captured','refund.processed'].includes(event.event))return NextResponse.json({received:true});
  // Refund events carry refund.entity.payment_id. Fetch authoritative cumulative
  // amounts from Razorpay; webhook deliveries may be duplicated or out of order.
  const id=event.event==='refund.processed'?event.payload?.refund?.entity?.payment_id:event.payload?.payment?.entity?.id;
  if(typeof id!=='string')throw new Error('Invalid event');
  await reconcileProviderPayment(id);
  return NextResponse.json({received:true});
 }catch{return NextResponse.json({error:'Webhook reconciliation failed; retry delivery'},{status:503});}
}
