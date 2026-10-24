import "server-only";
import { serverSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
export async function getAdminSession() {
 if(!isSupabaseConfigured())return false;
 const client=await serverSupabase();const {data:{user}}=await client.auth.getUser();if(!user)return false;
 const [{data:role},{data:profile}]=await Promise.all([client.from('account_roles').select('role').eq('user_id',user.id).eq('role','admin').maybeSingle(),client.from('profiles').select('account_status').eq('id',user.id).single()]);
 return Boolean(role&&profile?.account_status==='Active');
}
export async function clearAdminSession(){const client=await serverSupabase();await client.auth.signOut();}
