begin;
create function private.interest_notification() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.notifications(recipient_id,sender_id,type,title,message,entity_id,entity_type)
 select author_id,new.user_id,'interest','New request','Someone is interested in your post.',new.post_id,'post' from public.posts where id=new.post_id and author_id<>new.user_id;
 return new;
end $$;
create trigger interest_notification after insert on public.post_interests for each row execute function private.interest_notification();
create function private.offer_notification() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.notifications(recipient_id,sender_id,type,title,message,entity_id,entity_type)
 select s.user_id,b.owner_id,'business_offer','New business offer',left(new.body,200),b.id,'business' from public.business_saves s join public.businesses b on b.id=s.business_id
 where b.id=new.business_id and b.status='Live' and private.paid_listing(b.id) and not private.blocked(b.owner_id,s.user_id);
 return new;
end $$;
create trigger offer_notification after insert on public.business_offers for each row execute function private.offer_notification();
create function private.moderation_notification() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if old.status='Open' and new.status='Resolved' then
 insert into public.notifications(recipient_id,sender_id,type,title,message,entity_id,entity_type) values(new.reporter_id,new.reviewed_by,'moderation','Report reviewed','An administrator reviewed your report.',new.id,'report');
 end if;return new;
end $$;
create trigger moderation_notification after update on public.reports for each row execute function private.moderation_notification();
revoke all on function private.interest_notification(),private.offer_notification(),private.moderation_notification() from public,anon,authenticated;
commit;
