begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default 'Resident' check(length(full_name) between 1 and 100),
 avatar_path text, bio text not null default '', area text not null default '', city text not null default '',
 verified boolean not null default false, account_status text not null default 'Active' check(account_status in ('Active','Banned')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.profile_private (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 mobile text, age integer check(age between 13 and 120), gender text,
 location jsonb not null default '{}', privacy jsonb not null default '{"showAge":false,"showExactArea":false,"allowDirectMessages":true}',
 onboarding_complete boolean not null default false
);
create table public.account_roles (
 user_id uuid references public.profiles(id) on delete cascade,
 role text check(role in ('resident','business','admin')), primary key(user_id,role)
);
create table public.businesses (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null unique references public.profiles(id),
 name text not null check(length(name) between 1 and 150), category text not null default 'Other',
 data jsonb not null default '{}', status text not null default 'Draft' check(status in ('Draft','Live','Paused','Pending Approval','Removed')),
 verified boolean not null default false, featured boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.posts (
 id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles(id),
 type text not null check(type in ('fun','help')), category text not null,
 title text not null check(length(trim(title)) between 1 and 200), description text not null check(length(description)<=10000),
 location jsonb not null default '{}', latitude double precision check(latitude between -90 and 90), longitude double precision check(longitude between -180 and 180),
 visibility text not null default 'Public' check(visibility in ('Public','Nearby only','Private after approval')),
 status text not null default 'Active' check(status in ('Active','Completed','Draft','Solved','Removed')), data jsonb not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((latitude is null)=(longitude is null))
);
create table public.post_interests (
 post_id uuid references public.posts(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted')), created_at timestamptz not null default now(), primary key(post_id,user_id)
);
create table public.comments (
 id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id) on delete cascade,
 author_id uuid not null references public.profiles(id), body text not null check(length(trim(body)) between 1 and 3000), created_at timestamptz not null default now()
);
create table public.post_likes (post_id uuid references public.posts(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade, created_at timestamptz not null default now(), primary key(post_id,user_id));
create table public.post_saves (post_id uuid references public.posts(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade, created_at timestamptz not null default now(), primary key(post_id,user_id));
create table public.blocks (
 blocker_id uuid references public.profiles(id) on delete cascade, blocked_id uuid references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(blocker_id,blocked_id), check(blocker_id<>blocked_id)
);
create table public.conversations (
 id uuid primary key default gen_random_uuid(), context_key text not null unique,
 post_id uuid references public.posts(id), business_id uuid references public.businesses(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.conversation_members (
 conversation_id uuid references public.conversations(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade,
 read_at timestamptz, joined_at timestamptz not null default now(), primary key(conversation_id,user_id)
);
create table public.messages (
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete cascade,
 sender_id uuid not null references public.profiles(id), client_id uuid not null,
 body text not null check(length(trim(body)) between 1 and 5000), kind text not null default 'text' check(kind in ('text','location')),
 data jsonb not null default '{}', created_at timestamptz not null default now(), unique(sender_id,client_id)
);
create table public.reports (
 id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.profiles(id), reported_user_id uuid references public.profiles(id),
 item_type text not null check(item_type in ('Post','User','Business','Chat')), item_id uuid not null, item_label text not null,
 reason text not null check(reason in ('Spam','Fake post','Unsafe','Harassment','Wrong category','Fake listing','Wrong location','Closed permanently','Other')),
 status text not null default 'Open' check(status in ('Open','Resolved')), reviewed_by uuid references public.profiles(id), reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create unique index reports_one_open on public.reports(reporter_id,item_type,item_id) where status='Open';
create table public.notifications (
 id uuid primary key default gen_random_uuid(), recipient_id uuid not null references public.profiles(id) on delete cascade,
 sender_id uuid references public.profiles(id), type text not null, title text not null, message text not null,
 entity_id uuid, entity_type text, is_read boolean not null default false, created_at timestamptz not null default now()
);
create table public.business_offers (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, body text not null check(length(trim(body)) between 1 and 2000), image_path text, created_at timestamptz not null default now());
create table public.business_saves (business_id uuid references public.businesses(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade, created_at timestamptz not null default now(), primary key(business_id,user_id));
create table public.business_events (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), user_id uuid not null references public.profiles(id), kind text not null check(kind in ('view','message')), created_at timestamptz not null default now());
create table public.pricing_plans (
 id text primary key check(id in ('starter','growth','premium')), name text not null, amount_paise integer not null check(amount_paise>0),
 duration_days integer not null check(duration_days>0), data jsonb not null default '{}', active boolean not null default true
);
insert into public.pricing_plans values
 ('starter','Starter',49900,30,'{"description":"Local listing","features":["Business listing","Messages"]}',true),
 ('growth','Growth',99900,30,'{"description":"Grow your local presence","features":["Business listing","Offers"],"highlight":true}',true),
 ('premium','Premium',199900,30,'{"description":"Premium local presence","features":["Business listing","Offers","Analytics"]}',true);
create table public.payments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), business_id uuid not null references public.businesses(id),
 plan_id text not null references public.pricing_plans(id), amount_paise integer not null check(amount_paise>0), currency text not null default 'INR' check(currency='INR'),
 mode text not null check(mode in ('test','live')), idempotency_key uuid not null,
 razorpay_order_id text unique, razorpay_payment_id text unique,
 status text not null default 'created' check(status in ('created','paid','failed','refunded')), duration_days integer not null check(duration_days>0),
 created_at timestamptz not null default now(), verified_at timestamptz, unique(user_id,idempotency_key)
);
create table public.subscriptions (
 business_id uuid primary key references public.businesses(id), payment_id uuid not null unique references public.payments(id),
 plan_id text not null references public.pricing_plans(id), active_until timestamptz not null, cancelled_at timestamptz
);
create table public.media (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id), bucket text not null,
 path text not null unique, scope text not null check(scope in ('avatar','business','post')), entity_id uuid,
 created_at timestamptz not null default now()
);

create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.account_roles where user_id=auth.uid() and role='admin') $$;
create function private.active_user() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=auth.uid() and account_status='Active') $$;
create function private.blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a)) $$;
create function private.member(c uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.conversation_members where conversation_id=c and user_id=auth.uid()) $$;
create function private.can_post(p uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.posts x where x.id=p and private.active_user() and (
 private.is_admin() or x.author_id=auth.uid() or (x.status in ('Active','Completed','Solved') and not private.blocked(x.author_id,auth.uid()) and
 (x.visibility <> 'Private after approval' or exists(select 1 from public.post_interests i where i.post_id=x.id and i.user_id=auth.uid() and i.status='accepted')))))
$$;
create function private.can_message(c uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.active_user() and private.member(c) and not exists(select 1 from public.conversation_members m where m.conversation_id=c and private.blocked(auth.uid(),m.user_id))
$$;
create function private.immutable_owner() returns trigger language plpgsql set search_path='' as $$
begin
 if new.created_at is distinct from old.created_at then raise exception 'Creation time is immutable'; end if;
 if to_jsonb(new)->'author_id' is distinct from to_jsonb(old)->'author_id' or to_jsonb(new)->'owner_id' is distinct from to_jsonb(old)->'owner_id' then raise exception 'Ownership is immutable'; end if;
 new.updated_at=now(); return new;
end $$;
create trigger immutable_posts before update on public.posts for each row execute function private.immutable_owner();
create trigger immutable_businesses before update on public.businesses for each row execute function private.immutable_owner();
create trigger immutable_profiles before update on public.profiles for each row execute function private.immutable_owner();
create function private.new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,full_name) values(new.id,coalesce(nullif(left(new.raw_user_meta_data->>'full_name',100),''),'Resident'));
 insert into public.profile_private(user_id) values(new.id);
 insert into public.account_roles(user_id,role) values(new.id,'resident');
 return new;
end $$;
create trigger szocial_auth_profile after insert on auth.users for each row execute function private.new_user();

-- Read access is RLS scoped; all writes use narrowly checked transactional RPCs below.
-- No browser receives table mutation privileges for roles, billing, membership or ownership.
do $$ declare t text; begin
 foreach t in array array['profiles','profile_private','account_roles','businesses','posts','post_interests','comments','post_likes','post_saves','blocks','conversations','conversation_members','messages','reports','notifications','business_offers','business_saves','business_events','pricing_plans','payments','subscriptions','media'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create policy profiles_read on public.profiles for select to authenticated using(private.active_user() and (id=auth.uid() or private.is_admin() or (account_status='Active' and not private.blocked(id,auth.uid()))));
create policy private_read on public.profile_private for select to authenticated using(user_id=auth.uid() or private.is_admin());
create policy roles_read on public.account_roles for select to authenticated using(user_id=auth.uid() or private.is_admin());
create policy business_read on public.businesses for select to authenticated using(private.active_user() and (owner_id=auth.uid() or private.is_admin() or (status='Live' and not private.blocked(owner_id,auth.uid()))));
create policy posts_read on public.posts for select to authenticated using(private.can_post(id));
create policy interests_read on public.post_interests for select to authenticated using(private.can_post(post_id));
create policy comments_read on public.comments for select to authenticated using(private.can_post(post_id) and not private.blocked(author_id,auth.uid()));
create policy likes_read on public.post_likes for select to authenticated using(private.can_post(post_id));
create policy saves_read on public.post_saves for select to authenticated using(user_id=auth.uid() and private.can_post(post_id));
create policy blocks_read on public.blocks for select to authenticated using(blocker_id=auth.uid() or blocked_id=auth.uid());
create policy conversation_read on public.conversations for select to authenticated using(private.active_user() and private.member(id));
create policy members_read on public.conversation_members for select to authenticated using(private.active_user() and private.member(conversation_id));
create policy messages_read on public.messages for select to authenticated using(private.active_user() and private.member(conversation_id));
create policy reports_read on public.reports for select to authenticated using(reporter_id=auth.uid() or private.is_admin());
create policy notifications_read on public.notifications for select to authenticated using(recipient_id=auth.uid());
create policy offers_read on public.business_offers for select to authenticated using(exists(select 1 from public.businesses b where b.id=business_id));
create policy business_saves_read on public.business_saves for select to authenticated using(user_id=auth.uid());
create policy events_read on public.business_events for select to authenticated using(private.is_admin() or exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()));
create policy pricing_read on public.pricing_plans for select to authenticated using(active);
create policy payments_read on public.payments for select to authenticated using(user_id=auth.uid() or private.is_admin());
create policy subscriptions_read on public.subscriptions for select to authenticated using(private.is_admin() or exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()));
create policy media_read on public.media for select to authenticated using(owner_id=auth.uid() or scope='avatar' or (scope='post' and private.can_post(entity_id)) or (scope='business' and exists(select 1 from public.businesses b where b.id=entity_id)));

create index posts_feed on public.posts(status,type,created_at desc,id);
create index posts_location on public.posts(latitude,longitude) where latitude is not null;
create index posts_search on public.posts using gin(to_tsvector('simple',title||' '||description||' '||category||' '||coalesce(location->>'area','')||' '||coalesce(location->>'city','')));
create index comments_post on public.comments(post_id,created_at);
create index members_user on public.conversation_members(user_id,conversation_id);
create index messages_history on public.messages(conversation_id,created_at,id);
create index notifications_recipient on public.notifications(recipient_id,is_read,created_at desc);
create index reports_review on public.reports(status,created_at);
create index offers_business on public.business_offers(business_id,created_at);
create index events_business on public.business_events(business_id,created_at);
create index payments_business on public.payments(business_id,created_at);
create index media_entity on public.media(entity_id);

-- Clamp public post precision to a neighbourhood grid; private GPS remains in profile_private.
create function private.clean_location(l jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare lat double precision; lng double precision; begin
 lat=nullif(l->>'latitude','')::double precision; lng=nullif(l->>'longitude','')::double precision;
 if (lat is null)<>(lng is null) or lat not between -90 and 90 or lng not between -180 and 180 or lat='NaN'::float8 or lng='NaN'::float8 then raise exception 'Invalid coordinates'; end if;
 return jsonb_build_object('area',left(coalesce(l->>'area',''),150),'city',left(coalesce(l->>'city',''),150),'landmark',left(coalesce(l->>'landmark',''),150),'latitude',round(lat::numeric,3),'longitude',round(lng::numeric,3),'source',coalesce(l->>'source','manual'));
end $$;

create function public.app_mutate(action text, args jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid=auth.uid(); target uuid; other_user uuid; row_post public.posts; row_business public.businesses; row_chat public.conversations; loc jsonb; result_id uuid; ctxt text; blocked_by_me boolean;
begin
 if actor is null or not private.active_user() then raise exception 'Authentication required' using errcode='42501'; end if;
 target=nullif(args->>'id','')::uuid;
 if action='profile' then
  if args ? 'name' and length(trim(args->>'name')) not between 1 and 100 then raise exception 'Invalid name'; end if;
  loc=private.clean_location(coalesce(args->'location',(select location from public.profile_private where user_id=actor)));
  update public.profiles set full_name=coalesce(args->>'name',full_name), bio=coalesce(left(args->>'bio',2000),bio), area=loc->>'area',city=loc->>'city',avatar_path=case when args ? 'profilePhoto' then nullif(args->>'profilePhoto','') else avatar_path end where id=actor;
  update public.profile_private set mobile=coalesce(args->>'mobile',mobile),age=coalesce(nullif(args->>'age','')::int,age),gender=coalesce(args->>'gender',gender),location=loc,privacy=coalesce(args->'privacy',privacy),onboarding_complete=true where user_id=actor;
 elsif action='create_business' then
  insert into public.businesses(owner_id,name,category,data) values(actor,args->>'businessName',coalesce(args->>'category','Other'),jsonb_build_object('address',args->>'address','location',private.clean_location(coalesce(args->'location','{}')))) returning id into result_id;
  insert into public.account_roles values(actor,'business') on conflict do nothing;
 elsif action='create_post' then
  loc=private.clean_location(coalesce(args->'location','{}'));
  insert into public.posts(author_id,type,category,title,description,location,latitude,longitude,visibility,data)
  values(actor,args->>'type',args->>'category',trim(args->>'title'),coalesce(args->>'description',''),loc,(loc->>'latitude')::float8,(loc->>'longitude')::float8,coalesce(args->>'visibility','Public'),args - array['id','authorId','createdAt','updatedAt','status','reports','comments','savedByUserIds','interestedUserIds','acceptedUserIds','location','title','description','type','category','visibility']) returning id into result_id;
 elsif action in ('update_post','delete_post','close_post','interest','accept','reject','comment','like','save_post') then
  select * into row_post from public.posts where id=target for update;
  if not found or not private.can_post(target) then raise exception 'Post unavailable' using errcode='42501'; end if;
  if action in ('update_post','delete_post','close_post','accept','reject') and row_post.author_id<>actor and not private.is_admin() then raise exception 'Not your post' using errcode='42501'; end if;
  if action='update_post' then
   loc=private.clean_location(coalesce(args->'location',row_post.location));
   update public.posts set title=coalesce(args->>'title',title),description=coalesce(args->>'description',description),category=coalesce(args->>'category',category),location=loc,latitude=(loc->>'latitude')::float8,longitude=(loc->>'longitude')::float8,visibility=coalesce(args->>'visibility',visibility),data=data || (args - array['id','authorId','createdAt','updatedAt','status','reports','comments','savedByUserIds','interestedUserIds','acceptedUserIds','location','title','description','type','category','visibility']) where id=target;
  elsif action in ('delete_post','close_post') then update public.posts set status=case when action='delete_post' then 'Removed' else 'Completed' end where id=target;
  elsif action='interest' then
   if row_post.author_id=actor or row_post.status<>'Active' then raise exception 'Interest unavailable'; end if;
   if exists(select 1 from public.post_interests where post_id=target and user_id=actor) then delete from public.post_interests where post_id=target and user_id=actor;
   else insert into public.post_interests(post_id,user_id) values(target,actor); end if;
  elsif action in ('accept','reject') then
   other_user=(args->>'userId')::uuid;
   if action='accept' then update public.post_interests set status='accepted' where post_id=target and user_id=other_user;
   else delete from public.post_interests where post_id=target and user_id=other_user; end if;
  elsif action='comment' then
   insert into public.comments(post_id,author_id,body) values(target,actor,trim(args->>'text')) returning id into result_id;
   if row_post.author_id<>actor then insert into public.notifications(recipient_id,sender_id,type,title,message,entity_id,entity_type) values(row_post.author_id,actor,'comment','New comment','Someone commented on your post.',target,'post'); end if;
  elsif action='like' then
   if exists(select 1 from public.post_likes where post_id=target and user_id=actor) then delete from public.post_likes where post_id=target and user_id=actor;
   else insert into public.post_likes(post_id,user_id) values(target,actor); end if;
  elsif action='save_post' then
   if row_post.type='help' then raise exception 'Help posts cannot be saved'; end if;
   if exists(select 1 from public.post_saves where post_id=target and user_id=actor) then delete from public.post_saves where post_id=target and user_id=actor;
   else insert into public.post_saves(post_id,user_id) values(target,actor); end if;
  end if;
 elsif action='start_chat' then
  if args->>'postId' is not null then
   select * into row_post from public.posts where id=(args->>'postId')::uuid;
   if not found or not private.can_post(row_post.id) or row_post.status<>'Active' then raise exception 'Post unavailable'; end if;
   other_user=row_post.author_id;
  else
   select * into row_business from public.businesses where id=(args->>'businessId')::uuid and status='Live';
   if not found then raise exception 'Business unavailable'; end if; other_user=row_business.owner_id;
  end if;
  if actor=other_user or private.blocked(actor,other_user) or not exists(select 1 from public.profiles where id=other_user and account_status='Active') then raise exception 'Messaging unavailable'; end if;
  if coalesce((select (privacy->>'allowDirectMessages')::boolean from public.profile_private where user_id=other_user),true)=false then raise exception 'Direct messaging is disabled'; end if;
  ctxt=least(actor::text,other_user::text)||':'||greatest(actor::text,other_user::text)||':'||coalesce(row_post.id::text,row_business.id::text);
  perform pg_advisory_xact_lock(hashtextextended(ctxt,0));
  insert into public.conversations(context_key,post_id,business_id) values(ctxt,row_post.id,row_business.id) on conflict(context_key) do update set context_key=excluded.context_key returning id into result_id;
  insert into public.conversation_members(conversation_id,user_id) values(result_id,actor),(result_id,other_user) on conflict do nothing;
 elsif action='message' then
  -- Pair lock serializes sending and blocking; a committed block cannot race a send.
  select m.user_id into other_user from public.conversation_members m where m.conversation_id=target and m.user_id<>actor limit 1;
  perform pg_advisory_xact_lock(hashtextextended(least(actor::text,other_user::text)||greatest(actor::text,other_user::text),0));
  if not private.can_message(target) then raise exception 'Messaging unavailable' using errcode='42501'; end if;
  if coalesce(args->>'kind','text')='location' then loc=private.clean_location(args); end if;
  insert into public.messages(conversation_id,sender_id,client_id,body,kind,data) values(target,actor,(args->>'clientId')::uuid,trim(args->>'text'),coalesce(args->>'kind','text'),coalesce(loc,'{}'))
  on conflict(sender_id,client_id) do nothing returning id into result_id;
  if result_id is not null then
   update public.conversations set updated_at=now() where id=target;
   insert into public.notifications(recipient_id,sender_id,type,title,message,entity_id,entity_type) select user_id,actor,'message','New message','You have a new message.',target,'chat' from public.conversation_members where conversation_id=target and user_id<>actor;
  else select id into result_id from public.messages where sender_id=actor and client_id=(args->>'clientId')::uuid and conversation_id=target; if result_id is null then raise exception 'Idempotency key already used'; end if;
  end if;
 elsif action='block' then
  if not private.member(target) then raise exception 'Not a conversation participant'; end if;
  select user_id into other_user from public.conversation_members where conversation_id=target and user_id<>actor limit 1;
  perform pg_advisory_xact_lock(hashtextextended(least(actor::text,other_user::text)||greatest(actor::text,other_user::text),0));
  if args->>'blocked'='false' then delete from public.blocks where blocker_id=actor and blocked_id=other_user;
  else insert into public.blocks values(actor,other_user,now()) on conflict do nothing; end if;
 elsif action='read_chat' then
  if not private.member(target) then raise exception 'Not a conversation participant'; end if;
  update public.conversation_members set read_at=now() where conversation_id=target and user_id=actor;
 elsif action='report' then
  other_user=null;
  case args->>'itemType'
   when 'Post' then select author_id into other_user from public.posts where id=target and private.can_post(id);
   when 'User' then select id into other_user from public.profiles where id=target and id<>actor;
   when 'Business' then select owner_id into other_user from public.businesses where id=target and (status='Live' or owner_id=actor);
   when 'Chat' then if private.member(target) then select user_id into other_user from public.conversation_members where conversation_id=target and user_id<>actor limit 1; end if;
   else raise exception 'Invalid report target';
  end case;
  if other_user is null then raise exception 'Report target unavailable'; end if;
  insert into public.reports(reporter_id,reported_user_id,item_type,item_id,item_label,reason) values(actor,other_user,args->>'itemType',target,left(coalesce(args->>'itemLabel','Reported item'),200),args->>'reason') on conflict(reporter_id,item_type,item_id) where status='Open' do nothing returning id into result_id;
 elsif action in ('business_profile','business_status','offer','save_business','cancel_subscription','business_view') then
  select * into row_business from public.businesses where id=target for update;
  if not found then raise exception 'Business unavailable'; end if;
  if action in ('save_business','business_view') then
   if row_business.status<>'Live' or private.blocked(actor,row_business.owner_id) then raise exception 'Business unavailable'; end if;
   if action='save_business' then
    if exists(select 1 from public.business_saves where business_id=target and user_id=actor) then delete from public.business_saves where business_id=target and user_id=actor;
    else insert into public.business_saves values(target,actor,now()); end if;
   else insert into public.business_events(business_id,user_id,kind) values(target,actor,'view'); end if;
  else
   if row_business.owner_id<>actor then raise exception 'Not your business' using errcode='42501'; end if;
   if action='business_profile' then update public.businesses set name=coalesce(args->>'name',name),category=coalesce(args->>'category',category),data=data || (args - array['id','ownerId','createdAt','updatedAt','status','verified','featured','payment','views','saves','messages','rating','reviews','offers']) where id=target;
   elsif action='business_status' then
    if args->>'status' not in ('Live','Paused','Pending Approval') then raise exception 'Invalid status'; end if;
    if args->>'status' in ('Live','Pending Approval') and not exists(select 1 from public.subscriptions where business_id=target and active_until>now()) then raise exception 'A verified subscription is required'; end if;
    update public.businesses set status=args->>'status' where id=target;
   elsif action='offer' then insert into public.business_offers(business_id,body) values(target,args->>'text') returning id into result_id;
   elsif action='cancel_subscription' then update public.subscriptions set cancelled_at=now() where business_id=target; end if;
  end if;
 elsif action='read_notifications' then update public.notifications set is_read=true where recipient_id=actor;
 elsif action='verification_request' then
  insert into public.reports(reporter_id,reported_user_id,item_type,item_id,item_label,reason) values(actor,actor,'User',actor,'Verification request','Other') on conflict(reporter_id,item_type,item_id) where status='Open' do nothing;
 elsif action like 'admin_%' then
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  case action
   when 'admin_user_status' then update public.profiles set account_status=args->>'status' where id=target;
   when 'admin_verify_user' then update public.profiles set verified=true where id=target;
   when 'admin_business_status' then update public.businesses set status=args->>'status' where id=target;
   when 'admin_verify_business' then update public.businesses set verified=true where id=target;
   when 'admin_feature_business' then update public.businesses set featured=not featured where id=target;
   when 'admin_remove_post' then update public.posts set status='Removed' where id=target;
   when 'admin_resolve_report' then update public.reports set status='Resolved',reviewed_by=actor,reviewed_at=now() where id=target;
   else raise exception 'Unknown administrative action';
  end case;
 else raise exception 'Unknown action';
 end if;
 return jsonb_build_object('id',coalesce(result_id,target),'success',true);
end $$;
revoke all on function public.app_mutate(text,jsonb) from public,anon;
grant execute on function public.app_mutate(text,jsonb) to authenticated;
-- All private functions have explicit grants, never the default PUBLIC execute privilege.
revoke all on all functions in schema private from public,anon;
grant execute on function private.is_admin(),private.active_user(),private.blocked(uuid,uuid),private.member(uuid),private.can_post(uuid),private.can_message(uuid) to authenticated;
commit;
