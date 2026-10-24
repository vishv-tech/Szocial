begin;
create function private.distance_km(a float8,b float8,c float8,d float8) returns float8 language sql immutable set search_path='' as $$
 select case when a is null or b is null or c is null or d is null then null else 6371 * 2 * asin(sqrt(least(1.0,greatest(0.0,power(sin(radians(c-a)/2),2)+cos(radians(a))*cos(radians(c))*power(sin(radians(d-b)/2),2))))) end
$$;
create function public.discover_posts(search_query text default '', sort_mode text default 'nearby', viewer_lat float8 default null, viewer_lng float8 default null, viewer_area text default '', viewer_city text default '', categories text[] default null, post_type text default null, post_status text default 'Active', urgency text default null, page_size int default 20, page_offset int default 0)
returns setof public.posts language sql stable security invoker set search_path='' as $$
 select p.* from public.posts p where p.status=post_status and post_status in ('Active','Solved')
 and not(p.type='help' and p.author_id=auth.uid())
 and (urgency is null or p.data->>'urgency'=urgency) and (post_type is null or p.type=post_type) and (categories is null or p.category=any(categories))
 and (trim(search_query)='' or strpos(lower(p.title||' '||p.description||' '||p.category||' '||coalesce(p.location->>'area','')||' '||coalesce(p.location->>'city','')||' '||coalesce(p.location->>'landmark','')),lower(trim(search_query)))>0)
 order by
 case when sort_mode in ('nearby','farthest') then case when viewer_lat between -90 and 90 and viewer_lng between -180 and 180 and p.latitude is not null then 0 when lower(p.location->>'area')=lower(viewer_area) and viewer_area<>'' and lower(p.location->>'city')=lower(viewer_city) then 1 when lower(p.location->>'city')=lower(viewer_city) and viewer_city<>'' then 2 else 3 end end asc,
 case when sort_mode='nearby' then private.distance_km(viewer_lat,viewer_lng,p.latitude,p.longitude) end asc nulls last,
 case when sort_mode='farthest' then private.distance_km(viewer_lat,viewer_lng,p.latitude,p.longitude) end desc nulls last,
 case when sort_mode='oldest' then p.created_at end asc,
 case when sort_mode<>'oldest' then p.created_at end desc,p.id
 limit least(greatest(page_size,1),100) offset greatest(page_offset,0)
$$;
revoke all on function public.discover_posts(text,text,float8,float8,text,text,text[],text,text,text,int,int) from public,anon;
grant execute on function public.discover_posts(text,text,float8,float8,text,text,text[],text,text,text,int,int) to authenticated;
grant execute on function private.distance_km(float8,float8,float8,float8) to authenticated;
revoke all on function private.distance_km(float8,float8,float8,float8) from public,anon;

-- Only a verified server-side payment flow can create a subscription.
create function public.reserve_payment(business uuid, plan text, request_key uuid, payment_mode text) returns public.payments language plpgsql security definer set search_path='' as $$
declare p public.pricing_plans; result public.payments; actor uuid=auth.uid(); begin
 if not private.active_user() or not exists(select 1 from public.businesses where id=business and owner_id=actor) then raise exception 'Not your business' using errcode='42501'; end if;
 select * into p from public.pricing_plans where id=plan and active;
 if not found or payment_mode not in ('test','live') then raise exception 'Invalid plan or payment mode'; end if;
 insert into public.payments(user_id,business_id,plan_id,amount_paise,duration_days,mode,idempotency_key) values(actor,business,p.id,p.amount_paise,p.duration_days,payment_mode,request_key) on conflict(user_id,idempotency_key) do nothing;
 select * into result from public.payments where user_id=actor and idempotency_key=request_key;
 if result.business_id<>business or result.plan_id<>plan then raise exception 'Idempotency key belongs to another purchase'; end if;
 return result;
end $$;
revoke all on function public.reserve_payment(uuid,text,uuid,text) from public,anon;
grant execute on function public.reserve_payment(uuid,text,uuid,text) to authenticated;

create function public.finalize_payment(order_id text, provider_payment_id text, amount int, payment_mode text, refund boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare p public.payments; begin
 select * into p from public.payments where razorpay_order_id=order_id for update;
 if not found or p.amount_paise<>amount or p.mode<>payment_mode then raise exception 'Payment does not match the stored purchase'; end if;
 if p.status='refunded' then return; end if;
 if p.status='paid' and p.razorpay_payment_id<>provider_payment_id then raise exception 'Payment already reconciled'; end if;
 if refund then
  update public.payments set status='refunded' where id=p.id;
  update public.subscriptions set active_until=least(active_until,now()) where payment_id=p.id;
  update public.businesses set status='Paused' where id=p.business_id;
 elsif p.status<>'paid' then
  update public.payments set status='paid',razorpay_payment_id=provider_payment_id,verified_at=now() where id=p.id;
  insert into public.subscriptions(business_id,payment_id,plan_id,active_until) values(p.business_id,p.id,p.plan_id,now()+make_interval(days=>p.duration_days))
  on conflict(business_id) do update set payment_id=excluded.payment_id,plan_id=excluded.plan_id,active_until=greatest(public.subscriptions.active_until,now())+make_interval(days=>p.duration_days),cancelled_at=null;
 end if;
end $$;
revoke all on function public.finalize_payment(text,text,int,text,boolean) from public,anon,authenticated;
grant execute on function public.finalize_payment(text,text,int,text,boolean) to service_role;
grant all on all tables in schema public to service_role;

-- All buckets are private. Only the validated upload API writes using its server key.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('szocial-avatars','szocial-avatars',false,5242880,array['image/webp']),
 ('szocial-business','szocial-business',false,5242880,array['image/webp']),
 ('szocial-posts','szocial-posts',false,5242880,array['image/webp']);
create policy szocial_media_read on storage.objects for select to authenticated using (
 bucket_id in ('szocial-avatars','szocial-business','szocial-posts') and exists(select 1 from public.media m where m.bucket=bucket_id and m.path=name)
);
-- There are intentionally no authenticated INSERT/UPDATE/DELETE object policies.
-- Deletions and replacement cleanup go through the authenticated ownership-checked server API.

-- Realtime table changes are RLS-scoped, and subscriptions are authenticated.
-- Fail explicitly rather than silently skipping an unavailable publication.
alter publication supabase_realtime add table public.messages, public.conversations, public.blocks, public.notifications, public.posts, public.comments, public.post_interests, public.reports;
commit;
