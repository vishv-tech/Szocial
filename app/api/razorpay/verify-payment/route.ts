import { NextResponse } from 'next/server';
import { authenticatedClient } from '@/lib/supabase/server';
import { adminSupabase } from '@/lib/supabase/admin';
import { paymentConfiguration,razorpayRequest,validHmac } from '@/lib/payment-security';
import { sameOrigin } from '@/lib/auth-security';
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid origin'},{status:403});
 try {
  const {client,user}=await authenticatedClient(),body=await request.json(),{secret,mode}=paymentConfiguration();
  const {data:purchase}=await client.from('payments').select('*').eq('razorpay_order_id',body.razorpay_order_id).eq('user_id',user.id).single();
  if(!purchase||!validHmac(`${purchase.razorpay_order_id}|${body.razorpay_payment_id}`,body.razorpay_signature,secret))throw new Error('Payment verification failed');
  const payment=await razorpayRequest(`payments/${encodeURIComponent(body.razorpay_payment_id)}`);
  if(payment.status!=='captured'||payment.order_id!==purchase.razorpay_order_id||payment.amount!==purchase.amount_paise||payment.currency!=='INR'||payment.amount_refunded>0||payment.captured!==true)throw new Error('Payment has not been captured for this purchase');
  const {error}=await adminSupabase().rpc('finalize_payment',{order_id:purchase.razorpay_order_id,provider_payment_id:payment.id,amount:payment.amount,payment_mode:mode});if(error)throw error;
  return NextResponse.json({success:true,mock:false},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:'Verification failed'},{status:400});}
}
