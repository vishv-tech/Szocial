begin;
-- Exposed functions are invoker wrappers. Privileged implementations live in the
-- unexposed private schema and still validate verified identity and ownership.
alter function public.app_mutate(text,jsonb) set schema private;
alter function private.app_mutate(text,jsonb) rename to checked_mutation;
grant execute on function private.checked_mutation(text,jsonb) to authenticated;
create function public.app_mutate(action text,args jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select private.checked_mutation(action,args) $$;
revoke all on function public.app_mutate(text,jsonb) from public,anon;
grant execute on function public.app_mutate(text,jsonb) to authenticated;
alter function public.reserve_payment(uuid,text,uuid,text) set schema private;
grant execute on function private.reserve_payment(uuid,text,uuid,text) to authenticated;
create function public.reserve_payment(business uuid,plan text,request_key uuid,payment_mode text) returns public.payments language sql security invoker set search_path='' as $$ select private.reserve_payment(business,plan,request_key,payment_mode) $$;
revoke all on function public.reserve_payment(uuid,text,uuid,text) from public,anon;
grant execute on function public.reserve_payment(uuid,text,uuid,text) to authenticated;
-- Evaluate actor-wide RLS checks once per statement instead of once per row.
do $$ declare p record; expression text; begin
 for p in select tablename,policyname,qual from pg_policies where schemaname='public' and qual is not null loop
  expression=replace(replace(replace(p.qual,'auth.uid()','(select auth.uid())'),'private.active_user()','(select private.active_user())'),'private.is_admin()','(select private.is_admin())');
  execute format('alter policy %I on public.%I using (%s)',p.policyname,p.tablename,expression);
 end loop;
end $$;
create index blocks_target on public.blocks(blocked_id);
create index business_events_actor on public.business_events(user_id);
create index business_saves_actor on public.business_saves(user_id);
create index comments_author on public.comments(author_id);
create index conversations_business on public.conversations(business_id);
create index conversations_post on public.conversations(post_id);
create index media_owner on public.media(owner_id);
create index notifications_sender on public.notifications(sender_id);
create index payments_plan on public.payments(plan_id);
create index interests_actor on public.post_interests(user_id);
create index likes_actor on public.post_likes(user_id);
create index saves_actor on public.post_saves(user_id);
create index posts_author on public.posts(author_id);
create index reports_subject on public.reports(reported_user_id);
create index reports_reviewer on public.reports(reviewed_by);
create index subscriptions_plan on public.subscriptions(plan_id);
commit;
