"use client";
import { useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { uploadImage,deleteImage } from '@/lib/client-api';
import { useToast } from '@/components/ToastProvider';

export function EntityImages({label,scope,entityId,paths,urls,max=6,onSave}:{label:string;scope:'business'|'post';entityId:string;paths:string[];urls:string[];max?:number;onSave:(paths:string[])=>Promise<boolean>}){
 const lock=useRef(false),[busy,setBusy]=useState(false),{notify}=useToast();
 const change=async(files:File[],remove?:string)=>{
  if(lock.current)return;lock.current=true;setBusy(true);const uploaded:string[]=[];
  try{
   if(files.some(file=>file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)))throw new Error('Choose JPG, PNG or WebP images under 5 MB.');
   const kept=remove?paths.filter(p=>p!==remove):max===1?[]:paths;
   if(kept.length+files.length>max)throw new Error(`Choose up to ${max} images.`);
   for(const file of files)uploaded.push(await uploadImage(file,scope,entityId));
   if(!await onSave([...kept,...uploaded]))throw new Error('Images were not saved. Please retry.');
   for(const path of paths.filter(p=>!kept.includes(p)))void deleteImage(path).catch(()=>{});
  }catch(error){for(const path of uploaded)void deleteImage(path).catch(()=>{});notify({title:'Image update failed',description:error instanceof Error?error.message:'Try again',variant:'warning'});}
  finally{lock.current=false;setBusy(false);}
 };
 return <fieldset disabled={busy} className="space-y-3 rounded-2xl border border-dashed border-slate-200 p-4"><legend className="px-2 font-semibold">{label}</legend><div className="flex flex-wrap gap-3">{paths.map((path,i)=><div key={path}><img alt={`${label} ${i+1}`} src={urls[i]} className="h-24 w-24 rounded-xl object-cover"/><Button size="sm" variant="outline" onClick={()=>change([],path)}>Remove</Button></div>)}</div><label className="block text-sm">{busy?'Saving images…':'Choose images (JPG, PNG or WebP, up to 5 MB each)'}<input aria-label={label} type="file" accept="image/jpeg,image/png,image/webp" multiple={max>1} disabled={busy} onChange={event=>{const files=Array.from(event.currentTarget.files??[]);event.currentTarget.value='';if(files.length)void change(files);}}/></label></fieldset>;
}
