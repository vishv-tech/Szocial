"use client";
import { useEffect,useRef,useState } from 'react';
import {api} from '@/lib/client-api';
import type {Providers} from '@/lib/oauth-providers';
import { Button } from '@/components/Button';
export function SocialAuthButtons({business=false}:{business?:boolean}) {
 const [busy,setBusy]=useState(false),[providers,setProviders]=useState<Providers|null>(null),[message,setMessage]=useState('');const lock=useRef(false);
 const check=async()=>{try{setProviders(await api<Providers>('/api/auth/providers'));}catch{setProviders({google:'unknown',facebook:'unknown'});}};
 useEffect(()=>{void check();},[]);
 const start=async(provider:'google'|'facebook')=>{
  if(lock.current)return;lock.current=true;setBusy(true);setMessage('');
  try{const result=await api<{url:string}>('/api/auth/oauth',{provider,business});window.location.assign(result.url);}
  catch(error){setMessage(error instanceof Error?error.message:'Sign-in unavailable. Use email or try again.');lock.current=false;setBusy(false);}
 };
 const unavailable=providers&&Object.values(providers).some(status=>status!=='enabled');
 return <div className="space-y-3"><Button className="w-full" variant="outline" disabled={busy||providers?.google!=='enabled'} onClick={()=>start('google')}><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.3 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.97-3.38.97-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.93a6 6 0 0 1 0-3.86V7.48H3.06a10 10 0 0 0 0 9.04l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.48l3.34 2.59c.79-2.36 3-4.12 5.6-4.12Z"/></svg>Continue with Google</Button><Button className="w-full" variant="outline" disabled={busy||providers?.facebook!=='enabled'} onClick={()=>start('facebook')}><span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded bg-blue-600 font-bold text-white">f</span>Continue with Facebook</Button>{!providers?<p role="status">Checking social sign-in availability…</p>:null}{unavailable?<p role="status" className="text-sm text-szocial-muted">{providers.google==='disabled'?'Google sign-in is not configured. ':''}{providers.facebook==='disabled'?'Facebook sign-in is not configured. ':''}{Object.values(providers).includes('unknown')?'Social sign-in availability could not be checked. ':''}Use email signup or login. <button type="button" className="underline" onClick={()=>void check()}>Check again</button></p>:null}{message?<p role="alert" className="text-sm text-red-600">{message}</p>:null}</div>;
}
