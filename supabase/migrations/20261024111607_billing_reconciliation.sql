begin;
-- Match the existing product plans from the previous development branch.
update public.pricing_plans set amount_paise=case id when 'starter' then 9900 when 'growth' then 29900 when 'premium' then 79900 end;
alter table public.payments add column refunded_paise integer not null default 0 check(refunded_paise between 0 and amount_paise);
alter table public.payments add column entitlement_start timestamptz;
alter table public.payments add column entitlement_end timestamptz;
create function private.paid_listing(b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.subscriptions where business_id=b and active_until>now())
$$;
revoke all on function private.paid_listing(uuid) from public,anon;
grant execute on function private.paid_listing(uuid) to authenticated;
drop policy business_read on public.businesses;
create policy business_read on public.businesses for select to authenticated using(private.active_user() and (
 owner_id=(select auth.uid()) or private.is_admin() or (status='Live' and private.paid_listing(id) and not private.blocked(owner_id,auth.uid()))));
-- A cumulative provider refund cannot be replayed to subtract entitlement twice.
-- Serialize renewals and refunds for the same business, even for different orders.
create function public.reconcile_payment(order_id text,provider_payment_id text,amount int,payment_mode text,cumulative_refund int default 0) returns void
language plpgsql security definer set search_path='' as $$
declare p public.payments; starts timestamptz; ends timestamptz; duration interval; begin
 select * into p from public.payments where razorpay_order_id=order_id;
 if not found then raise exception 'Payment unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p.business_id::text,0));
 select * into p from public.payments where id=p.id for update;
 if p.amount_paise<>amount or p.mode<>payment_mode or cumulative_refund not between 0 and amount or nullif(provider_payment_id,'') is null then raise exception 'Payment does not match the stored purchase'; end if;
 if p.razorpay_payment_id is not null and p.razorpay_payment_id<>provider_payment_id then raise exception 'Payment already reconciled'; end if;
 if p.entitlement_start is null then
  select greatest(active_until,now()) into starts from public.subscriptions where business_id=p.business_id;
  starts=coalesce(starts,now());ends=starts+make_interval(days=>p.duration_days);
  update public.payments set status='paid',razorpay_payment_id=provider_payment_id,verified_at=now(),entitlement_start=starts,entitlement_end=ends where id=p.id returning * into p;
  insert into public.subscriptions(business_id,payment_id,plan_id,active_until) values(p.business_id,p.id,p.plan_id,ends)
  on conflict(business_id) do update set payment_id=excluded.payment_id,plan_id=excluded.plan_id,active_until=excluded.active_until,cancelled_at=null;
 end if;
 -- Partial refunds are recorded; full refunds revoke only this purchase's duration.
 if cumulative_refund>p.refunded_paise then
  update public.payments set refunded_paise=cumulative_refund,status=case when cumulative_refund=amount then 'refunded' else 'paid' end where id=p.id;
  if cumulative_refund=amount and p.refunded_paise<amount then
   duration=greatest(interval '0',p.entitlement_end-greatest(p.entitlement_start,now()));
   update public.payments set entitlement_start=entitlement_start-duration,entitlement_end=entitlement_end-duration where business_id=p.business_id and id<>p.id and entitlement_start>=p.entitlement_end;
   update public.subscriptions set active_until=greatest(now(),active_until-duration) where business_id=p.business_id;
   if not private.paid_listing(p.business_id) then update public.businesses set status='Paused' where id=p.business_id; end if;
  end if;
 end if;
end $$;
revoke all on function public.reconcile_payment(text,text,int,text,int) from public,anon,authenticated;
grant execute on function public.reconcile_payment(text,text,int,text,int) to service_role;
-- Retain the original capture RPC signature for existing server callers. Refunds
-- must use the cumulative reconciliation endpoint, never a boolean payload.
create or replace function public.finalize_payment(order_id text,provider_payment_id text,amount int,payment_mode text,refund boolean default false) returns void
language plpgsql security definer set search_path='' as $$ begin
 if refund then raise exception 'Use cumulative refund reconciliation'; end if;
 perform public.reconcile_payment(order_id,provider_payment_id,amount,payment_mode,0);
end $$;
commit;
