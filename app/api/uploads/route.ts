import { NextResponse } from "next/server";
import sharp from "sharp";
import { authenticatedClient } from "@/lib/supabase/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { sameOrigin } from "@/lib/auth-security";
export const runtime='nodejs';
const buckets={avatar:'szocial-avatars',business:'szocial-business',post:'szocial-posts'};
export async function POST(request:Request) {
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid origin'},{status:403});
 try {
  const {client,user}=await authenticatedClient();
  if(Number(request.headers.get('content-length')??0)>6*1024*1024)throw new Error('Image exceeds 5 MB');
  const form=await request.formData(),file=form.get('file'),scope=form.get('scope') as keyof typeof buckets,entity=String(form.get('entityId')??'');
  if(!(file instanceof File)||file.size>5*1024*1024||!Object.hasOwn(buckets,scope))throw new Error('Choose a JPG, PNG or WebP image under 5 MB.');
  if(scope!=='avatar') {
   const {data}=await client.from(scope==='post'?'posts':'businesses').select(scope==='post'?'author_id':'owner_id').eq('id',entity).single();
   if(!data||Object.values(data)[0]!==user.id)throw new Error('Not the owner');
  }
  const input=Buffer.from(await file.arrayBuffer());
  const image=sharp(input,{limitInputPixels:25000000,animated:false});
  const metadata=await image.metadata();
  if(!['jpeg','png','webp'].includes(metadata.format??'')||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Unsupported image content');
  const output=await image.rotate().resize(1600,1600,{fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
  const path=`${user.id}/${scope==='avatar'?'profile':entity}/${crypto.randomUUID()}.webp`,bucket=buckets[scope],admin=adminSupabase();
  const {error:uploadError}=await admin.storage.from(bucket).upload(path,output,{contentType:'image/webp',upsert:false});if(uploadError)throw uploadError;
  const {error}=await admin.from('media').insert({owner_id:user.id,bucket,path,scope,entity_id:scope==='avatar'?null:entity});
  if(error){await admin.storage.from(bucket).remove([path]);throw error;}
  return NextResponse.json({path});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Image upload failed'},{status:400});}
}
export async function DELETE(request:Request) {
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid origin'},{status:403});
 try {
  const {user}=await authenticatedClient(),{path}=await request.json(),admin=adminSupabase();
  const {data:media}=await admin.from('media').select('*').eq('path',path).eq('owner_id',user.id).single();
  if(!media)throw new Error('Image unavailable');
  const [{data:profile},{data:business},{data:posts}]=await Promise.all([
   admin.from('profiles').select('id').eq('avatar_path',path),admin.from('businesses').select('data').eq('owner_id',user.id),admin.from('posts').select('data').eq('author_id',user.id)
  ]);
  if(profile?.length||[...(business??[]),...(posts??[])].some(row=>JSON.stringify(row.data).includes(path)))throw new Error('Remove or replace the image reference before deleting the file.');
  const {error}=await admin.storage.from(media.bucket).remove([path]);if(error)throw error;
  const {error:dbError}=await admin.from('media').delete().eq('id',media.id);if(dbError)throw dbError;
  return NextResponse.json({success:true});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Delete failed'},{status:400});}
}
