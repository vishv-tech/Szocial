"use client";
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {useAppStore} from '@/components/AppStoreProvider';
import {AuthLayout} from '@/components/AuthLayout';
import {Button} from '@/components/Button';
import {api} from '@/lib/client-api';
export default function Onboarding(){
 const {currentUser,hydrated,reload,currentBusiness}=useAppStore();const router=useRouter();
 const [name,setName]=useState(''),[area,setArea]=useState(''),[city,setCity]=useState(''),[business,setBusiness]=useState(false),[businessName,setBusinessName]=useState(''),[address,setAddress]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(hydrated){setName(currentUser.name);setArea(currentUser.location.area);setCity(currentUser.location.city);}},[hydrated,currentUser.id,currentUser.name,currentUser.location.area,currentUser.location.city]);
 const field=(label:string,value:string,change:(v:string)=>void)=><label className="block text-sm font-semibold">{label}<input className="mt-2 w-full rounded-2xl border p-3" required value={value} onChange={e=>change(e.target.value)}/></label>;
 return <AuthLayout title="Complete your profile" subtitle="Choose your neighbourhood to find relevant plans and help."><form className="space-y-4" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{await api('/api/app',{action:'profile',args:{name,location:{area,city,source:'manual'}}});if(business&&!currentBusiness)await api('/api/app',{action:'create_business',args:{businessName,address,category:'Other',location:{area,city}}});await reload();router.replace(business||currentBusiness?'/business/dashboard':'/home');router.refresh();}catch(e){setError(e instanceof Error?e.message:'Setup failed');}finally{setBusy(false);}}}>
 {field('Full name',name,setName)}{field('Area',area,setArea)}{field('City',city,setCity)}
 <label className="flex items-center gap-2"><input type="checkbox" checked={business} onChange={e=>setBusiness(e.target.checked)}/>I also want to list my business</label>
 {business&&!currentBusiness?<>{field('Business name',businessName,setBusinessName)}{field('Business address',address,setAddress)}</>:null}
 {error?<p role="alert" className="text-sm text-red-600">{error}</p>:null}<Button disabled={busy||!hydrated} type="submit">{busy?'Saving…':'Continue'}</Button>
 </form></AuthLayout>;
}
