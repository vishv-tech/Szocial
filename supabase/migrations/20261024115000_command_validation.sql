begin;
create or replace function private.checked_mutation(action text,args jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare allowed text[]; clean jsonb; result jsonb; actor uuid=auth.uid(); target uuid; other_user uuid; conversation uuid; post public.posts; begin
 if actor is null or not private.active_user() then raise exception 'Authentication required' using errcode='42501'; end if;
 if jsonb_typeof(args)<>'object' or octet_length(args::text)>100000 then raise exception 'Invalid command'; end if;
 allowed=case
 when action='profile' then array['name','bio','mobile','age','gender','privacy','location','profilePhoto']
 when action in ('create_post','update_post') then array['id','type','category','title','description','location','landmark','date','time','neededPeople','genderPreference','ageGroup','visibility','urgency','budget','contactPreference','images']
 when action='create_business' then array['businessName','category','address','location']
 when action='business_profile' then array['id','name','category','address','location','phone','whatsapp','mapsLink','hours','about','services','tags','priceRange','offers','logo','coverImage','gallery']
 else null end;
 if action in ('create_post','update_post') and args ? 'urgency' and args->>'urgency' not in ('Normal','Urgent') then raise exception 'Invalid urgency'; end if;
 if action='business_profile' then
  if exists(select 1 from jsonb_each(args) where key in ('services','tags','offers') and (jsonb_typeof(value)<>'array' or jsonb_array_length(value)>50)) then raise exception 'Invalid listing collection'; end if;
  if exists(select 1 from jsonb_each(args) a cross join lateral jsonb_array_elements(case when a.key in ('services','tags','offers') and jsonb_typeof(a.value)='array' then a.value else '[]' end) v where jsonb_typeof(v)<>'string' or length(v#>>'{}')>2000) then raise exception 'Invalid listing text'; end if;
 end if;
 if action='start_chat' and args->>'businessId' is not null and not private.paid_listing((args->>'businessId')::uuid) then raise exception 'Business subscription expired'; end if;
 if action='accept' and exists(select 1 from public.posts p join public.post_interests i on i.post_id=p.id where p.id=(args->>'id')::uuid and p.author_id=actor and i.user_id=(args->>'userId')::uuid and i.status='accepted') then
  select c.id into conversation from public.conversations c join public.conversation_members m on m.conversation_id=c.id where c.post_id=(args->>'id')::uuid and m.user_id=(args->>'userId')::uuid and private.member(c.id);
  if conversation is not null then return jsonb_build_object('id',conversation,'success',true); end if;
 end if;
 clean=args;
 if allowed is not null then select coalesce(jsonb_object_agg(key,value),'{}') into clean from jsonb_each(args) where key=any(allowed); end if;
 if action='profile' and args ? 'privacy' then
  if jsonb_typeof(args->'privacy')<>'object' or exists(select 1 from jsonb_each(args->'privacy') where key not in ('showAge','showExactArea','allowDirectMessages') or jsonb_typeof(value)<>'boolean') then raise exception 'Invalid privacy preferences'; end if;
 end if;
 if action in ('create_business','business_profile') and args ? 'location' then clean=jsonb_set(clean,'{location}',private.clean_location(args->'location')); end if;
 if action='business_profile' then
  if args ? 'mapsLink' and coalesce(args->>'mapsLink','')<>'' and args->>'mapsLink' !~ '^https://(www[.])?(google[.]com/maps/|maps[.]google[.]com/|maps[.]app[.]goo[.]gl/)' then raise exception 'Invalid map link'; end if;
 end if;
 if action='message' and args->>'kind'='location' and (args->>'latitude' is null or args->>'longitude' is null) then raise exception 'Location requires coordinates'; end if;
 if action in ('update_post','admin_post_status') and args ? 'status' then
  target=(args->>'id')::uuid;
  select * into post from public.posts where id=target for update;
  if not private.is_admin() and (not found or post.author_id<>actor) then raise exception 'Not your post'; end if;
  if args->>'status' not in ('Active','Completed','Solved','Draft') then raise exception 'Invalid status'; end if;
  if action='admin_post_status' and not private.is_admin() then raise exception 'Administrator required'; end if;
  if action='update_post' then result=private.mutate_internal(action,clean);
 if action='business_profile' and args ? 'offers' then
  target=(args->>'id')::uuid;
  delete from public.business_offers where business_id=target and body not in (select jsonb_array_elements_text(args->'offers'));
  insert into public.business_offers(business_id,body) select target,value from jsonb_array_elements_text(args->'offers') value where trim(value)<>'' and not exists(select 1 from public.business_offers o where o.business_id=target and o.body=value);
 end if;
 if action='create_post' and args->>'withImages'='true' then update public.posts set status='Draft' where id=(result->>'id')::uuid; end if; end if;
  update public.posts set status=args->>'status' where id=target;
  return jsonb_build_object('id',target,'success',true);
 end if;
 result=private.mutate_internal(action,clean);
 if action='business_profile' and args ? 'offers' then
  target=(args->>'id')::uuid;
  delete from public.business_offers where business_id=target and body not in (select jsonb_array_elements_text(args->'offers'));
  insert into public.business_offers(business_id,body) select target,value from jsonb_array_elements_text(args->'offers') value where trim(value)<>'' and not exists(select 1 from public.business_offers o where o.business_id=target and o.body=value);
 end if;
 if action='create_post' and args->>'withImages'='true' then update public.posts set status='Draft' where id=(result->>'id')::uuid; end if;
 if action='profile' then
  update public.profiles set area=case when (select privacy->>'showExactArea'='true' from public.profile_private where user_id=actor) then area else '' end where id=actor;
 end if;
 if action='close_post' then update public.posts set status='Solved' where id=(args->>'id')::uuid and type='help'; end if;
 if action='accept' then
  target=(args->>'id')::uuid; other_user=(args->>'userId')::uuid;
  if exists(select 1 from public.post_interests where post_id=target and user_id=other_user and status='accepted') then
   if private.blocked(actor,other_user) then raise exception 'Messaging unavailable'; end if;
   insert into public.conversations(context_key,post_id) values(least(actor::text,other_user::text)||':'||greatest(actor::text,other_user::text)||':'||target::text,target)
   on conflict(context_key) do update set context_key=excluded.context_key returning id into conversation;
   insert into public.conversation_members(conversation_id,user_id) values(conversation,actor),(conversation,other_user) on conflict do nothing;
   insert into public.notifications(recipient_id,sender_id,type,title,message,entity_id,entity_type) values(other_user,actor,'accepted','Request accepted','Your request was accepted.',conversation,'chat');
   return jsonb_build_object('id',conversation,'success',true);
  end if;
 end if;
 return result;
end $$;
create or replace function private.reserve_payment(business uuid, plan text, request_key uuid, payment_mode text) returns public.payments language plpgsql security definer set search_path='' as $$
declare p public.pricing_plans; result public.payments; actor uuid=auth.uid(); begin
 if not private.active_user() or not exists(select 1 from public.businesses where id=business and owner_id=actor) then raise exception 'Not your business' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||business::text||plan||payment_mode,0));
 select * into p from public.pricing_plans where id=plan and active;
 if not found or payment_mode not in ('test','live') then raise exception 'Invalid plan or payment mode'; end if;
 select * into result from public.payments where user_id=actor and idempotency_key=request_key;
 if found then
  if result.business_id<>business or result.plan_id<>plan or result.mode<>payment_mode then raise exception 'Idempotency key belongs to another purchase'; end if;
  return result;
 end if;
 select * into result from public.payments where user_id=actor and business_id=business and plan_id=plan and mode=payment_mode and status='created' order by created_at limit 1;
 if found then return result; end if;
 insert into public.payments(user_id,business_id,plan_id,amount_paise,duration_days,mode,idempotency_key) values(actor,business,p.id,p.amount_paise,p.duration_days,payment_mode,request_key) on conflict(user_id,idempotency_key) do nothing;
 select * into result from public.payments where user_id=actor and idempotency_key=request_key;
 if result.business_id<>business or result.plan_id<>plan or result.mode<>payment_mode then raise exception 'Idempotency key belongs to another purchase'; end if;
 return result;
end $$;
commit;
