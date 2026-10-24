begin;
alter table public.payments add column order_claimed_at timestamptz;
create function public.claim_payment_order(payment uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.payments set order_claimed_at=now() where id=payment and order_claimed_at is null and razorpay_order_id is null and status='created';
 return found;
end $$;
revoke all on function public.claim_payment_order(uuid) from public,anon,authenticated;
grant execute on function public.claim_payment_order(uuid) to service_role;
commit;
