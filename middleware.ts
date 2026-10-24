import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabaseConfig } from "@/lib/supabase/config";
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({request});
  response.headers.set("Cache-Control", "private, no-store");
  const publicPath = /^\/(?:$|login|signup|check-email|forgot-password|reset-password|auth\/|api\/auth\/|admin\/login|business\/(login|signup))/.test(request.nextUrl.pathname);
  if (!isSupabaseConfigured()) {
    if (publicPath || request.nextUrl.pathname.startsWith('/api/')) return response;
    return NextResponse.redirect(new URL('/login?error=Supabase+configuration+required',request.url));
  }
  const {url,key} = supabaseConfig();
  const client = createServerClient(url,key,{cookies:{
    getAll:()=>request.cookies.getAll(),
    setAll:(entries,headers)=>{
      entries.forEach(({name,value})=>request.cookies.set(name,value));
      response=NextResponse.next({request});
      entries.forEach(({name,value,options})=>response.cookies.set(name,value,options));
      Object.entries(headers ?? {}).forEach(([name,value])=>response.headers.set(name,String(value)));
      response.headers.set('Cache-Control','private, no-store');
    }
  }});
  const {data:{user}}=await client.auth.getUser();
  if (!publicPath && !request.nextUrl.pathname.startsWith('/api/')) {
    const redirectTo = (path:string) => {
      const target=NextResponse.redirect(new URL(path,request.url));
      response.cookies.getAll().forEach(cookie=>target.cookies.set(cookie));
      target.headers.set('Cache-Control','private, no-store');
      return target;
    };
    if (!user) return redirectTo('/login');
    const [{data:profile},{data:roles},{data:privateProfile,error:privateError}] = await Promise.all([
      client.from('profiles').select('account_status').eq('id',user.id).single(),
      client.from('account_roles').select('role').eq('user_id',user.id),
      client.from('profile_private').select('onboarding_complete').eq('user_id',user.id).single()
    ]);
    if (profile?.account_status !== 'Active') return redirectTo('/login?error=Account+unavailable');
    if(request.nextUrl.pathname!=='/onboarding'&&(privateError||!privateProfile?.onboarding_complete))return redirectTo('/onboarding'+(request.nextUrl.pathname.startsWith('/business/')?'?business=1':''));
    if (request.nextUrl.pathname.startsWith('/admin') && !roles?.some(r=>r.role==='admin')) return redirectTo('/home');
    if (request.nextUrl.pathname.startsWith('/business/') && !roles?.some(r=>r.role==='business')) return redirectTo('/onboarding?business=1');
  }
  return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)']};
