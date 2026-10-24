"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/Button';
import { api } from '@/lib/client-api';
export function RecoveryForm({reset=false}:{reset?:boolean}){
 const [value,setValue]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');const router=useRouter();
 return <AuthLayout title={reset?'Choose a new password':'Reset your password'} subtitle={reset?'Use a unique password of at least 12 characters.':'We will send a reset link if an account exists for this address.'}><form className="space-y-4" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setMessage('');try{await api('/api/auth/'+(reset?'reset':'forgot'),reset?{password:value}:{email:value});if(reset){router.replace('/home');router.refresh();}else setMessage('If the address is registered, check your email for a reset link.');}catch(error){setMessage(error instanceof Error?error.message:'Please try again.');}finally{setBusy(false);}}}>
 <label className="block text-sm font-semibold">{reset?'New password':'Email'}<input className="mt-2 w-full rounded-2xl border p-3" autoComplete={reset?'new-password':'email'} type={reset?'password':'email'} minLength={reset?12:undefined} required value={value} onChange={e=>setValue(e.target.value)}/></label>
 <Button disabled={busy} type="submit">{busy?'Please wait…':reset?'Save password':'Send reset link'}</Button>{message?<p role="status" className="text-sm">{message}</p>:null}
 </form></AuthLayout>;
}
