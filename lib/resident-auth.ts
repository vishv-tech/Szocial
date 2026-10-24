// Legacy browser records are never an authentication source. Supabase verifies identities.
// This module only exposes a deliberate, redacted export for manual migration review.
export function exportLegacyOwnPosts(verifiedEmail:string) {
 if(typeof window==='undefined')return [];
 try {
  const user=JSON.parse(localStorage.getItem('szocial_user')??'null');
  if(!user||String(user.email).toLowerCase()!==verifiedEmail.toLowerCase())throw new Error('Legacy account does not match your verified email.');
  const state=JSON.parse(localStorage.getItem('szocial-mvp-state-v2')??'{}');
  return (Array.isArray(state.posts)?state.posts:[]).filter((post:{authorId?:string})=>post.authorId===user.id).map((post:{title:string;description:string;type:string;category:string;createdAt:string;location?:{city?:string;area?:string}})=>({title:post.title,description:post.description,type:post.type,category:post.category,originalCreatedAt:post.createdAt,location:{area:post.location?.area,city:post.location?.city}}));
 }catch(error){throw new Error(error instanceof Error?error.message:'Could not read legacy records');}
}

/** Retain legacy posts for deliberate export while retiring plaintext credentials. */
export function retireLegacyCredentials(){
 if(typeof window==='undefined')return;
 const redact=(value:unknown):unknown=>Array.isArray(value)?value.map(redact):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!['password','confirmPassword','access_token','refresh_token'].includes(key)).map(([key,item])=>[key,redact(item)])):value;
 try{
  for(const key of ['szocial_auth','szocial_admin_auth','szocial_business_auth'])window.localStorage.removeItem(key);
  for(const key of ['szocial_user','szocial_users','szocial-mvp-state-v2']){const raw=window.localStorage.getItem(key);if(raw){const clean=JSON.stringify(redact(JSON.parse(raw)));if(clean!==raw)window.localStorage.setItem(key,clean);}}
 }catch{/* Unreadable legacy data never affects authenticated application state. */}
}
