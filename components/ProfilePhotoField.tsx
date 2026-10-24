"use client";
import {useRef,useState} from 'react';
import {ProfileImageCropper} from '@/components/ProfileImageCropper';
import {loadImageFromFile,validateProfileImageFile} from '@/lib/image-crop';
import {Button} from '@/components/Button';
export function ProfilePhotoField({value,onChange}:{value:string;onChange:(photo:string)=>void}){
 const [pending,setPending]=useState<{src:string;name:string}|null>(null),[error,setError]=useState('');const serial=useRef(0);
 return <div className="space-y-3"><label className="block text-sm font-semibold">Profile photo (optional)<input aria-label="Choose profile photo" className="mt-2 block w-full" type="file" accept="image/jpeg,image/png,image/webp" onChange={async event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';const request=++serial.current;if(!file)return;const invalid=validateProfileImageFile(file);setError(invalid);if(invalid)return;try{const src=await loadImageFromFile(file);if(request===serial.current)setPending({src,name:file.name});}catch{setError('Could not read this photo. Choose another file.');}}}/></label>{value?<div><img alt="Selected profile photo" src={value} className="h-24 w-24 rounded-full object-cover"/><Button variant="outline" size="sm" onClick={()=>onChange('')}>Remove photo</Button></div>:null}{error?<p role="alert" className="text-sm text-red-600">{error}</p>:null}<ProfileImageCropper open={Boolean(pending)} imageSrc={pending?.src??''} fileName={pending?.name??''} onCancel={()=>setPending(null)} onError={setError} onUsePhoto={photo=>{onChange(photo);setPending(null);setError('');}}/></div>;
}
