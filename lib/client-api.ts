export class ApiError extends Error {
 constructor(message:string,public status:number,public outcome?:string,public retryAfter?:number){super(message);this.name='ApiError';}
}
export async function api<T>(url:string,body?:unknown,signal?:AbortSignal):Promise<T> {
 const response=await fetch(url,{signal,method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json();
 if(!response.ok)throw new ApiError(data.error??'Request failed',response.status,data.outcome,data.retryAfter??(Number(response.headers.get('retry-after'))||undefined));
 return data;
}
export async function uploadImage(source:File|string,scope:'avatar'|'business'|'post',entityId?:string) {
 const form=new FormData();
 const file=typeof source==='string'?await (await fetch(source)).blob():source;
 form.set('file',file,'image.webp');form.set('scope',scope);if(entityId)form.set('entityId',entityId);
 const response=await fetch('/api/uploads',{method:'POST',body:form});const result=await response.json();if(!response.ok)throw new Error(result.error??'Image upload failed');return result.path as string;
}

export async function deleteImage(path:string){
 const response=await fetch('/api/uploads',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({path})});
 if(!response.ok)throw new Error('Image cleanup failed');
}
