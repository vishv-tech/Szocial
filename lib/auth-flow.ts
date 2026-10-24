export const EMAIL_COOLDOWN_SECONDS = 120;
export type SignupOutcome =
 | {outcome:'confirmation_required'|'authenticated';next:string;retryAfter?:number}
 | {outcome:'rejected'|'rate_limited'|'uncertain';message:string;retryAfter?:number};
export function maskedEmail(email:string){const [local,domain]=email.split('@');return domain?`${local.slice(0,1)}***@${domain}`:'your email address';}
export function retrySeconds(value:string|null,minimum=EMAIL_COOLDOWN_SECONDS){
 const seconds=value&&/^\d+$/.test(value)?Number(value):value?Math.ceil((Date.parse(value)-Date.now())/1000):0;
 return Math.max(minimum,Number.isFinite(seconds)?seconds:0);
}
export function onboardingPath(business:boolean){return business?'/onboarding?business=1':'/onboarding';}
export function callbackIntent(url:URL){
 const next=url.searchParams.get('next')??url.searchParams.get('redirect_to');
 if(url.searchParams.get('intent')==='business')return true;
 try{const target=new URL(next??'',url.origin);if(target.origin!==url.origin)return false;
  if(target.searchParams.get('business')==='1'||target.searchParams.get('intent')==='business')return true;
  const nested=target.searchParams.get('next');return nested===onboardingPath(true);
 }catch{return false;}
}
