begin;
-- The CLI cannot start in this cloud image (read-only ~/.supabase); this additive
-- migration is versioned explicitly and verified against PostgreSQL before hosting.
create function private.check_media_reference(path_value text, expected_scope text, expected_entity uuid, expected_owner uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if path_value is null or path_value='' then return; end if;
 perform 1 from public.media where path=path_value and owner_id=expected_owner and scope=expected_scope
 and entity_id is not distinct from expected_entity for key share;
 if not found then raise exception 'Invalid or unowned image reference' using errcode='42501'; end if;
end $$;
create function private.validate_media_references() returns trigger language plpgsql security definer set search_path='' as $$
declare image_path text; begin
 if tg_table_name='profiles' then
  perform private.check_media_reference(new.avatar_path,'avatar',null,new.id);
 elsif tg_table_name='businesses' then
  perform private.check_media_reference(new.data->>'logo','business',new.id,new.owner_id);
  perform private.check_media_reference(new.data->>'coverImage','business',new.id,new.owner_id);
  if new.data ? 'gallery' then
   if jsonb_typeof(new.data->'gallery')<>'array' or jsonb_array_length(new.data->'gallery')>12 then raise exception 'Invalid gallery'; end if;
   for image_path in select jsonb_array_elements_text(new.data->'gallery') loop
    perform private.check_media_reference(image_path,'business',new.id,new.owner_id);
   end loop;
  end if;
 elsif tg_table_name='posts' and new.data ? 'images' then
  if jsonb_typeof(new.data->'images')<>'array' or jsonb_array_length(new.data->'images')>6 then raise exception 'Invalid post images'; end if;
  for image_path in select jsonb_array_elements_text(new.data->'images') loop
   perform private.check_media_reference(image_path,'post',new.id,new.author_id);
  end loop;
 end if;
 return new;
end $$;
create trigger validate_profile_media before insert or update on public.profiles for each row execute function private.validate_media_references();
create trigger validate_business_media before insert or update on public.businesses for each row execute function private.validate_media_references();
create trigger validate_post_media before insert or update on public.posts for each row execute function private.validate_media_references();
-- Serialize detach/delete against new references. The API deletes the metadata
-- first; a failed Storage deletion leaves an inaccessible orphan, never a broken reference.
create function private.guard_media_delete() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.profiles where avatar_path=old.path)
 or exists(select 1 from public.posts where data->'images' ? old.path)
 or exists(select 1 from public.businesses where data->>'logo'=old.path or data->>'coverImage'=old.path or data->'gallery' ? old.path)
 then raise exception 'Image is still referenced'; end if;
 return old;
end $$;
create trigger guard_media_delete before delete on public.media for each row execute function private.guard_media_delete();
drop policy media_read on public.media;
create policy media_read on public.media for select to authenticated using(private.active_user() and (
 owner_id=(select auth.uid()) or
 (scope='avatar' and exists(select 1 from public.profiles p where p.id=owner_id and p.avatar_path=path)) or
 (scope='post' and private.can_post(entity_id) and exists(select 1 from public.posts p where p.id=entity_id and p.data->'images' ? path)) or
 (scope='business' and exists(select 1 from public.businesses b where b.id=entity_id and (b.data->>'logo'=path or b.data->>'coverImage'=path or b.data->'gallery' ? path)))
));
create or replace function private.can_message(c uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.active_user() and private.member(c) and not exists(
 select 1 from public.conversation_members m join public.profiles p on p.id=m.user_id
 where m.conversation_id=c and (p.account_status<>'Active' or private.blocked(auth.uid(),m.user_id)))
$$;
-- Keep the original transaction implementation private and validate the public
-- command boundary before it can store arbitrary metadata.
alter function public.app_mutate(text,jsonb) set schema private;
alter function private.app_mutate(text,jsonb) rename to mutate_internal;
revoke all on function private.mutate_internal(text,jsonb) from public,anon,authenticated;
create function public.app_mutate(action text,args jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare allowed text[]; clean jsonb; result jsonb; actor uuid=auth.uid(); target uuid; other_user uuid; conversation uuid; post public.posts; begin
 if actor is null or not private.active_user() then raise exception 'Authentication required' using errcode='42501'; end if;
 if jsonb_typeof(args)<>'object' or octet_length(args::text)>100000 then raise exception 'Invalid command'; end if;
 allowed=case
 when action='profile' then array['name','bio','mobile','age','gender','privacy','location','profilePhoto']
 when action in ('create_post','update_post') then array['id','type','category','title','description','location','landmark','date','time','neededPeople','genderPreference','ageGroup','visibility','urgency','budget','contactPreference','images']
 when action='create_business' then array['businessName','category','address','location']
 when action='business_profile' then array['id','name','category','address','location','phone','whatsapp','mapsLink','hours','about','services','tags','priceRange','logo','coverImage','gallery']
 else null end;
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
 if action='create_post' and args->>'withImages'='true' then update public.posts set status='Draft' where id=(result->>'id')::uuid; end if; end if;
  update public.posts set status=args->>'status' where id=target;
  return jsonb_build_object('id',target,'success',true);
 end if;
 result=private.mutate_internal(action,clean);
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
revoke all on function public.app_mutate(text,jsonb) from public,anon;
grant execute on function public.app_mutate(text,jsonb) to authenticated;
revoke all on function private.check_media_reference(text,text,uuid,uuid),private.validate_media_references(),private.guard_media_delete() from public,anon,authenticated;
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='public' loop
 execute format('create policy active_account on public.%I as restrictive for select to authenticated using (private.active_user())',t);
 end loop; end $$;
-- Publication includes read receipts and all data sources rendered by connected clients.
alter publication supabase_realtime add table public.conversation_members,public.profiles,public.businesses,public.business_offers,public.post_likes,public.post_saves,public.business_saves,public.payments,public.subscriptions;
commit;
