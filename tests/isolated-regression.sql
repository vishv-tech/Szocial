-- ISOLATED TEST DATABASE ONLY. Never run this fixture-writing suite against
-- the main hosted Szocial project. Local tests/database.test.cjs is the default.
-- Rollback does not make destructive test cases suitable for the live project.
begin;
select set_config('szocial.test.a',gen_random_uuid()::text,true),set_config('szocial.test.b',gen_random_uuid()::text,true),set_config('szocial.test.c',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data) values
 (current_setting('szocial.test.a')::uuid,'szocial-a-'||current_setting('szocial.test.a')||'@example.invalid','{"full_name":"SQL test A","role":"admin"}'),
 (current_setting('szocial.test.b')::uuid,'szocial-b-'||current_setting('szocial.test.b')||'@example.invalid','{}'),
 (current_setting('szocial.test.c')::uuid,'szocial-c-'||current_setting('szocial.test.c')||'@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('szocial.test.a'),true);
do $$ declare result jsonb; begin
 if exists(select 1 from public.account_roles where role='admin') then raise exception 'Metadata elevated role'; end if;
 if (select count(*) from public.profile_private)<>1 then raise exception 'Private profile RLS failed'; end if;
 result=public.app_mutate('create_post','{"type":"fun","category":"Cricket","title":"SQL regression cricket","description":"Test","location":{"area":"Wadala","city":"Mumbai","latitude":19.017,"longitude":72.858}}');
 perform set_config('szocial.test.post',result->>'id',true);
 result=public.app_mutate('create_post','{"type":"help","category":"Tutor","title":"SQL regression help","description":"Help"}');
 perform set_config('szocial.test.help',result->>'id',true);
 if exists(select 1 from public.discover_posts() where id=(result->>'id')::uuid) then raise exception 'Own Help leaked'; end if;
 perform public.app_mutate('close_post',jsonb_build_object('id',result->>'id'));
end $$;
select set_config('request.jwt.claim.sub',current_setting('szocial.test.b'),true);
do $$ declare result jsonb; begin
 if not exists(select 1 from public.discover_posts(search_query=>'SQL regression cricket')) then raise exception 'Discovery failed'; end if;
 if not exists(select 1 from public.discover_posts(post_status=>'Solved') where id=current_setting('szocial.test.help')::uuid) then raise exception 'Solved Help failed'; end if;
 begin
  perform public.app_mutate('update_post',jsonb_build_object('id',current_setting('szocial.test.post'),'title','Hijack'));
  raise exception 'Ownership check failed';
 exception when insufficient_privilege then null; end;
 result=public.app_mutate('start_chat',jsonb_build_object('postId',current_setting('szocial.test.post')));
 perform set_config('szocial.test.chat',result->>'id',true);
 perform public.app_mutate('message',jsonb_build_object('id',result->>'id','text','Hosted SQL hello','clientId',gen_random_uuid()));
end $$;
select set_config('request.jwt.claim.sub',current_setting('szocial.test.c'),true);
do $$ begin if exists(select 1 from public.messages) then raise exception 'Cross-account message leak'; end if; end $$;
select set_config('request.jwt.claim.sub',current_setting('szocial.test.a'),true);
do $$ begin
 if (select count(*) from public.messages where conversation_id=current_setting('szocial.test.chat')::uuid)<>1 then raise exception 'Shared message missing'; end if;
 if not exists(select 1 from public.notifications where recipient_id=auth.uid()) then raise exception 'Notification missing'; end if;
 perform public.app_mutate('block',jsonb_build_object('id',current_setting('szocial.test.chat'),'blocked',true));
 begin
  perform public.app_mutate('message',jsonb_build_object('id',current_setting('szocial.test.chat'),'text','Must fail','clientId',gen_random_uuid()));
  raise exception 'Block did not prevent send';
 exception when insufficient_privilege then null; end;
 perform public.app_mutate('report',jsonb_build_object('id',current_setting('szocial.test.chat'),'itemType','Chat','reason','Spam'));
 begin
  perform public.finalize_payment('order_fake','pay_fake',1,'test');raise exception 'Client finalized payment';
 exception when insufficient_privilege then null; end;
 begin
  perform public.app_mutate('profile',jsonb_build_object('profilePhoto',current_setting('szocial.test.b')||'/profile/forged.webp'));raise exception 'Forged image accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if exists(select 1 from pg_tables where schemaname='public' and not rowsecurity) then raise exception 'Unprotected application table'; end if;
 if (select count(*) from storage.buckets where id in ('szocial-avatars','szocial-business','szocial-posts') and not public)<>3 then raise exception 'Private buckets missing'; end if;
 if (select count(*) from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename in ('messages','conversation_members','blocks','notifications'))<>4 then raise exception 'Realtime publication missing'; end if;
end $$;
select 'PASS: hosted RLS, trigger, ownership, discovery, Help, shared messaging, blocking, reports, notifications, media denial, billing denial, private buckets, Realtime publication' as result;
rollback;
