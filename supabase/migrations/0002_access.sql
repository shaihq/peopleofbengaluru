-- Designers of Bengaluru — THE GATE (CLAUDE.md Phase 5D-B)
-- Being visible is earned: an invite code (instant, no review) or a reviewed application.
-- This migration adds invite codes, access settings and the two server functions the
-- gate calls. Payments (5D-C) and the review queue (5D-D) come later.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Settings (config-driven, change without a release)
-- ---------------------------------------------------------------------------

create table if not exists public.app_settings (
  key   text primary key,
  value jsonb not null
);

insert into public.app_settings (key, value) values
  ('invites_per_member', '2'),
  ('invite_sent_expiry_days', '30')
on conflict (key) do nothing;

alter table public.app_settings enable row level security;
drop policy if exists "settings are public" on public.app_settings;
create policy "settings are public" on public.app_settings for select using (true);

create or replace function public.setting_int(p_key text, p_default int) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::int from public.app_settings where key = p_key), p_default)
$$;

-- ---------------------------------------------------------------------------
-- Profiles: who invited you, and the 'rejected' state for applications
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists invited_by uuid references auth.users (id) on delete set null;
alter table public.profiles add column if not exists review_note text check (char_length(review_note) <= 400);

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check
  check (status in ('pending', 'approved', 'hidden', 'rejected'));

-- ---------------------------------------------------------------------------
-- Invite codes
-- ---------------------------------------------------------------------------

create table if not exists public.invites (
  code        text primary key check (code ~ '^BLR-[A-Z0-9]{6}$'),
  -- null = a founder code made by the admin
  owner       uuid references auth.users (id) on delete cascade,
  state       text not null default 'available' check (state in ('available', 'sent', 'used', 'revoked')),
  created_at  timestamptz not null default now(),
  -- creating an invite link for someone starts the expiry clock
  sent_at     timestamptz,
  used_by     uuid references auth.users (id) on delete set null,
  used_at     timestamptz,
  note        text check (char_length(note) <= 120)
);

create index if not exists invites_owner on public.invites (owner);

alter table public.invites enable row level security;

-- You can see your own codes. Nobody writes to this table directly: only the
-- functions below (and the admin) do.
drop policy if exists "read own invites" on public.invites;
create policy "read own invites" on public.invites for select using (auth.uid() = owner);
revoke insert, update, delete on public.invites from anon, authenticated;

-- 6 characters from an alphabet without look-alikes (no 0/O, 1/I/L): ~887M codes.
create or replace function public.gen_invite_code() returns text
language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := 'BLR-';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.invites where code = c);
  end loop;
  return c;
end $$;

-- Give someone (or, with null, nobody: founder codes) n fresh codes.
create or replace function public.issue_invites(p_owner uuid, p_n int) returns setof text
language plpgsql volatile security definer set search_path = public as $$
declare
  c text;
begin
  for i in 1..greatest(p_n, 0) loop
    c := public.gen_invite_code();
    insert into public.invites (code, owner) values (c, p_owner);
    return next c;
  end loop;
end $$;

-- Only the admin (SQL editor / service role) may mint codes.
revoke execute on function public.issue_invites(uuid, int) from public, anon, authenticated;
revoke execute on function public.gen_invite_code() from public, anon, authenticated;

-- What a code is worth, without using it: ok / invalid / used / expired / own.
create or replace function public.invite_state(r public.invites) returns text
language sql stable security definer set search_path = public as $$
  select case
    when r.code is null then 'invalid'
    when r.state = 'revoked' then 'invalid'
    when r.state = 'used' then 'used'
    when r.state = 'sent' and r.sent_at < now() - make_interval(days => public.setting_int('invite_sent_expiry_days', 30)) then 'expired'
    when r.owner is not null and r.owner = auth.uid() then 'own'
    else 'ok'
  end
$$;

-- The gate's CHECK button. Returns the inviter's name so the gate can say who vouched.
create or replace function public.check_invite(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r public.invites;
  st text;
  who public.profiles;
begin
  select * into r from public.invites where code = upper(trim(p_code));
  st := public.invite_state(r);
  if st <> 'ok' then
    return jsonb_build_object('state', st);
  end if;
  select * into who from public.profiles where id = r.owner;
  return jsonb_build_object(
    'state', 'ok',
    'inviter_name', coalesce(who.name, 'The founders'),
    'inviter_role', coalesce(who.role, 'Designers of Bengaluru')
  );
end $$;

grant execute on function public.check_invite(text) to anon, authenticated;

-- End of the invite path, after the magic-link sign-in: in ONE transaction the code is
-- re-checked and marked used, your profile goes live (approved, no review), and you get
-- your own codes to share.
create or replace function public.redeem_invite(p_code text, p_profile jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r public.invites;
  st text;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'state', 'signed_out');
  end if;

  select * into r from public.invites where code = upper(trim(p_code)) for update;
  st := public.invite_state(r);
  if st <> 'ok' then
    return jsonb_build_object('ok', false, 'state', st);
  end if;

  insert into public.profiles as p (
    id, name, role, company, location, building, previously, open_to_work, skills,
    portfolio, linkedin, x, character, spot, status, invited_by
  ) values (
    uid,
    p_profile ->> 'name',
    p_profile ->> 'role',
    nullif(p_profile ->> 'company', ''),
    coalesce(nullif(p_profile ->> 'location', ''), 'Koramangala'),
    nullif(p_profile ->> 'building', ''),
    nullif(p_profile ->> 'previously', ''),
    coalesce((p_profile ->> 'open_to_work')::boolean, false),
    coalesce(array(select jsonb_array_elements_text(p_profile -> 'skills')), '{}'),
    nullif(p_profile ->> 'portfolio', ''),
    nullif(p_profile ->> 'linkedin', ''),
    nullif(p_profile ->> 'x', ''),
    coalesce(nullif(p_profile ->> 'character', ''), 'designer'),
    coalesce(nullif(p_profile ->> 'spot', ''), 'junction'),
    'approved',
    r.owner
  )
  on conflict (id) do update set
    name = excluded.name, role = excluded.role, company = excluded.company,
    location = excluded.location, building = excluded.building, previously = excluded.previously,
    open_to_work = excluded.open_to_work, skills = excluded.skills, portfolio = excluded.portfolio,
    linkedin = excluded.linkedin, x = excluded.x, character = excluded.character, spot = excluded.spot,
    -- an invite approves an application that was waiting (or turned down) too
    status = 'approved', invited_by = excluded.invited_by;

  update public.invites set state = 'used', used_by = uid, used_at = now() where code = r.code;

  if not exists (select 1 from public.invites where owner = uid) then
    perform public.issue_invites(uid, public.setting_int('invites_per_member', 2));
  end if;

  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.redeem_invite(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Existing members: everyone already approved gets their codes
-- ---------------------------------------------------------------------------

do $$
declare
  p record;
begin
  for p in
    select id from public.profiles pr
    where pr.status = 'approved' and not exists (select 1 from public.invites i where i.owner = pr.id)
  loop
    perform public.issue_invites(p.id, public.setting_int('invites_per_member', 2));
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Admin cheatsheet (run in the SQL editor)
-- ---------------------------------------------------------------------------
-- Make 5 founder codes (no owner):        select public.issue_invites(null, 5);
-- See every code and its state:           select code, owner, state, sent_at, used_at from public.invites order by created_at desc;
-- See your own codes:                     select code, state from public.invites where owner = (select id from auth.users where email = 'you@example.com');
-- Revoke a code:                          update public.invites set state = 'revoked' where code = 'BLR-XXXXXX';
