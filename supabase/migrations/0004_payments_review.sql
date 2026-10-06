-- Designers of Bengaluru — PAYMENT (DODO) + ADMIN REVIEW (CLAUDE.md Phase 5E-B)
-- Dodo Payments takes the application fee; a reviewer (public.admins) accepts or
-- rejects + refunds. Payment and refund states are written by the server only
-- (src/app/api/*, with the secret key) after Dodo confirms them — never by the client.
--
-- Run once in the Supabase SQL editor, after 0001–0003. Safe to re-run.

-- What the fee is and which Dodo product charges it, per mode (test / live — DODO_ENV).
-- Config-driven: change the price by creating a new Dodo product (brand "People of
-- Bangalore") and updating these rows — no release needed.
insert into public.app_settings (key, value) values
  ('application_fee', '{"amount": 59900, "currency": "INR"}'),
  ('dodo_product_id', '{"test": "pdt_0NpATO97x4iFOk1i9S7Xm", "live": null}'),
  ('review_auto_refund_days', '14')
on conflict (key) do nothing;

alter table public.applications add column if not exists checkout_id text;
alter table public.applications add column if not exists refund_id text;

create index if not exists applications_payment on public.applications (payment_id);

-- ACCEPT. Admins only (checked inside, so it can be called straight from the admin page).
-- In one transaction: the profile snapshot becomes a live profile (approved), the new
-- member gets their invite codes, and the application is marked approved.
create or replace function public.approve_application(p_id uuid, p_note text default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  a public.applications;
  p jsonb;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'state', 'not_admin');
  end if;

  select * into a from public.applications where id = p_id for update;
  if a.id is null then
    return jsonb_build_object('ok', false, 'state', 'missing');
  end if;
  if a.status not in ('paid', 'under_review') then
    return jsonb_build_object('ok', false, 'state', 'not_reviewable', 'status', a.status);
  end if;

  p := a.profile;
  insert into public.profiles as pr (
    id, name, role, company, location, building, previously, open_to_work, skills,
    portfolio, linkedin, x, character, spot, status
  ) values (
    a.user_id,
    p ->> 'name',
    p ->> 'role',
    nullif(p ->> 'company', ''),
    coalesce(nullif(p ->> 'location', ''), 'Koramangala'),
    nullif(p ->> 'building', ''),
    nullif(p ->> 'previously', ''),
    coalesce((p ->> 'open_to_work')::boolean, false),
    coalesce(array(select jsonb_array_elements_text(p -> 'skills')), '{}'),
    nullif(p ->> 'portfolio', ''),
    nullif(p ->> 'linkedin', ''),
    nullif(p ->> 'x', ''),
    coalesce(nullif(p ->> 'character', ''), 'designer'),
    coalesce(nullif(p ->> 'spot', ''), 'junction'),
    'approved'
  )
  on conflict (id) do update set
    name = excluded.name, role = excluded.role, company = excluded.company,
    location = excluded.location, building = excluded.building, previously = excluded.previously,
    open_to_work = excluded.open_to_work, skills = excluded.skills, portfolio = excluded.portfolio,
    linkedin = excluded.linkedin, x = excluded.x, character = excluded.character, spot = excluded.spot,
    status = 'approved';

  if not exists (select 1 from public.invites where owner = a.user_id) then
    perform public.issue_invites(a.user_id, public.setting_int('invites_per_member', 2));
  end if;

  update public.applications
    set status = 'approved', reviewer = auth.uid(), reason = nullif(trim(p_note), ''), decided_at = now()
    where id = a.id;

  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.approve_application(uuid, text) to authenticated;
