import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {onboardingPath} from '@/lib/auth-flow';
export async function authDestination(client:SupabaseClient,business:boolean){
 const {data:{user},error}=await client.auth.getUser();if(error||!user)throw new Error('Session could not be verified');
 const [{data:profile,error:profileError},{data:roles,error:rolesError}]=await Promise.all([
  client.from('profile_private').select('onboarding_complete').eq('user_id',user.id).single(),
  client.from('account_roles').select('role').eq('user_id',user.id)
 ]);
 if(profileError||rolesError)throw new Error('Profile could not be checked');
 const ownsBusiness=roles?.some(r=>r.role==='business');
 if(!profile?.onboarding_complete||business&&!ownsBusiness)return onboardingPath(business);
 return ownsBusiness?'/business/dashboard':'/home';
}
