import 'server-only';
import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {cookies} from 'next/headers';
import {EMAIL_COOLDOWN_SECONDS} from '@/lib/auth-flow';
const cache=globalThis as typeof globalThis&{szocialAuthDevelopmentKey?:Buffer};
const runtimeKey=cache.szocialAuthDevelopmentKey??=randomBytes(32);
const cookieName='szocial-email-confirmation';
type Pending={email:string;business:boolean;retryAt:number;expiresAt:number;accepted:boolean};
function key(){const secret=process.env.AUTH_RATE_LIMIT_SECRET||process.env.SUPABASE_SECRET_KEY;if(!secret&&process.env.NODE_ENV==='production')throw new Error('Email confirmation requires a stable server-only encryption key.');return secret?createHash('sha256').update('szocial-auth-flow:'+secret).digest():runtimeKey;}
export async function pendingSignup():Promise<Pending|null>{
 try{const value=(await cookies()).get(cookieName)?.value;if(!value)return null;
 const bytes=Buffer.from(value,'base64url'),decipher=createDecipheriv('aes-256-gcm',key(),bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));
 const data=JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString()) as Pending;
 return data.expiresAt>Date.now()&&typeof data.email==='string'?data:null;}catch{return null;}
}
export async function savePendingSignup(data:Omit<Pending,'expiresAt'>,request:Request){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);
 const body=Buffer.concat([cipher.update(JSON.stringify({...data,expiresAt:Date.now()+86400000})),cipher.final()]);
 (await cookies()).set(cookieName,Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64url'),{httpOnly:true,sameSite:'lax',secure:new URL(request.url).protocol==='https:',path:'/',maxAge:86400});
}
// Bounded per-process abuse guard supplements the encrypted browser cooldown.
// Supabase's project-wide limiter remains authoritative across instances.
const attempts=new Map<string,number>();
export function claimEmailAttempt(email:string){
 const now=Date.now(),id=createHash('sha256').update(email.toLowerCase()).digest('hex'),until=attempts.get(id)??0;
 if(until>now)return Math.ceil((until-now)/1000);
 for(const [entry,expiry] of attempts)if(expiry<=now)attempts.delete(entry);
 if(attempts.size>=10000)return EMAIL_COOLDOWN_SECONDS;
 attempts.set(id,now+EMAIL_COOLDOWN_SECONDS*1000);return 0;
}

export async function clearPendingSignup(){(await cookies()).set(cookieName,'',{httpOnly:true,sameSite:'lax',path:'/',maxAge:0});}
