import 'server-only';
import { adminSupabase } from '@/lib/supabase/admin';
import { paymentConfiguration,razorpayRequest } from '@/lib/payment-security';
export async function reconcileProviderPayment(paymentId:string){
 if(!/^pay_[a-zA-Z0-9]+$/.test(paymentId))throw new Error('Invalid provider payment');
 const payment=await razorpayRequest(`payments/${encodeURIComponent(paymentId)}`),{mode}=paymentConfiguration();
 if(payment.id!==paymentId||!payment.order_id||payment.currency!=='INR'||!payment.captured||!['captured','refunded'].includes(payment.status)||!Number.isInteger(payment.amount)||!Number.isInteger(payment.amount_refunded??0))throw new Error('Payment has not been captured');
 const admin=adminSupabase();
 const order=await razorpayRequest(`orders/${encodeURIComponent(payment.order_id)}`);
 if(order.id!==payment.order_id||order.currency!=='INR'||order.amount!==payment.amount)throw new Error('Order does not match payment');
 const internalId=order.receipt;
 const {data:purchase,error}=await admin.from('payments').select('*').eq('id',internalId).eq('mode',mode).single();
 if(error||!purchase||purchase.amount_paise!==payment.amount||purchase.razorpay_order_id&&purchase.razorpay_order_id!==order.id)throw new Error('Unknown purchase');
 if(!purchase.razorpay_order_id){const {error}=await admin.from('payments').update({razorpay_order_id:order.id}).eq('id',purchase.id).is('razorpay_order_id',null);if(error)throw error;}
 const {error:finalError}=await admin.rpc('reconcile_payment',{order_id:order.id,provider_payment_id:payment.id,amount:payment.amount,payment_mode:mode,cumulative_refund:payment.amount_refunded??0});
 if(finalError)throw finalError;
}
