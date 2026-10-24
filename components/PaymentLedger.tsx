"use client";
import {useState} from 'react';
import {useAppStore} from '@/components/AppStoreProvider';
import {useToast} from '@/components/ToastProvider';
import {Button} from '@/components/Button';
import {api} from '@/lib/client-api';
export function PaymentLedger(){
 const {state,reload}=useAppStore(),{notify}=useToast(),[busy,setBusy]=useState('');
 return <section className="space-y-3 rounded-3xl bg-white p-5 text-szocial-ink"><h2 className="text-xl font-bold">Payment records</h2><p className="text-sm">Plans are prepaid for 30 days. Renewals require another verified payment. Reconcile checks Razorpay before updating a record.</p>{state.paymentHistory.map(payment=><div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><p>{payment.planName} · ₹{payment.amount} · {payment.status}</p><p className="text-xs">{payment.mode} · Refunded: ₹{payment.refundedAmount??0}</p><p className="break-all text-xs">{payment.paymentId}</p></div><Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={async()=>{setBusy(payment.id);try{const result=await api<{status:string}>('/api/razorpay/reconcile',{id:payment.id});await reload();notify({title:result.status==='awaiting_payment'?'Awaiting captured payment':'Payment reconciled'});}catch(error){notify({title:'Reconciliation pending',description:error instanceof Error?error.message:'Retry later',variant:'warning'});}finally{setBusy('');}}}>{busy===payment.id?'Checking…':'Reconcile'}</Button></div>)}{!state.paymentHistory.length?<p>No payment records.</p>:null}</section>;
}
