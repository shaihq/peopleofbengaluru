-- People of Bengaluru — YOUR INVITES (CLAUDE.md Phase 5D, spec docs/superpowers/specs/2026-10-08-invite-flow-design.md)
-- Members turn a code into a link (marked sent, 30-day clock), see who joined, and get a fresh code
-- back when a link goes unused. An expired code stays dead: check_invite keeps answering 'expired'.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Schema: the 'expired' state, and who an unused link was for
-- ---------------------------------------------------------------------------

alter table public.invites drop constraint if exists invites_state_check;
alter table public.invites add constraint invites_state_check
  check (state in ('available', 'sent', 'used', 'revoked', 'expired'));

-- On a fresh code that replaced an unused link: that link's "who's it for" ('' when it had none).
alter table public.invites add column if not exists renewed_from text check (char_length(renewed_from) <= 40);

-- An expired code reads as expired whether or not it has been renewed yet.
create or replace function public.invite_state(r public.invites) returns text
language sql stable security definer set search_path = public as $$
  select case
    when r.code is null then 'invalid'
    when r.state = 'revoked' then 'invalid'
    when r.state = 'used' then 'used'
    when r.state = 'expired' then 'expired'
    when r.state = 'sent' and r.sent_at < now() - make_interval(days => public.setting_int('invite_sent_expiry_days', 30)) then 'expired'
    when r.owner is not null and r.owner = auth.uid() then 'own'
    else 'ok'
  end
$$;

-- ---------------------------------------------------------------------------
-- create_invite_link: one of your ready codes becomes a sent link
-- ---------------------------------------------------------------------------

create or replace function public.create_invite_link(p_code text, p_note text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r public.invites;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'state', 'signed_out');
  end if;
  select * into r from public.invites where code = upper(trim(p_code)) and owner = uid for update;
  if r.code is null then
    return jsonb_build_object('ok', false, 'state', 'invalid');
  end if;
  if r.state <> 'available' then
    return jsonb_build_object('ok', false, 'state', r.state);
  end if;
  update public.invites
    set state = 'sent', sent_at = now(), note = left(nullif(trim(coalesce(p_note, '')), ''), 40)
    where code = r.code
    returning * into r;
  return jsonb_build_object('ok', true, 'code', r.code, 'sent_at', r.sent_at);
end $$;

revoke execute on function public.create_invite_link(text, text) from public, anon;
grant execute on function public.create_invite_link(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- my_invites: renew unused links, then list your slots
-- ---------------------------------------------------------------------------

create or replace function public.my_invites() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  exp_days int := public.setting_int('invite_sent_expiry_days', 30);
  old record;
  fresh text;
begin
  if uid is null then
    return '[]'::jsonb;
  end if;

  -- a link unused for exp_days is dead; its slot comes back as a fresh code
  for old in
    select code, note from public.invites
    where owner = uid and state = 'sent' and sent_at < now() - make_interval(days => exp_days)
    for update
  loop
    update public.invites set state = 'expired' where code = old.code;
    fresh := public.gen_invite_code();
    insert into public.invites (code, owner, renewed_from) values (fresh, uid, coalesce(old.note, ''));
  end loop;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'code', i.code,
      'state', i.state,
      'note', i.note,
      'sent_at', i.sent_at,
      'expires_at', case when i.sent_at is null then null else i.sent_at + make_interval(days => exp_days) end,
      'renewed_from', i.renewed_from,
      'joined', case when i.state = 'used' then jsonb_build_object(
        'name', coalesce(p.name, 'A new member'),
        'role', p.role,
        'at', i.used_at
      ) end
    ) order by i.created_at, i.code)
    from public.invites i
    left join public.profiles p on p.id = i.used_by and p.status = 'approved'
    where i.owner = uid and i.state in ('available', 'sent', 'used')
  ), '[]'::jsonb);
end $$;

revoke execute on function public.my_invites() from public, anon;
grant execute on function public.my_invites() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin cheatsheet
-- ---------------------------------------------------------------------------
-- Test renewal: update public.invites set sent_at = now() - interval '31 days' where code = 'BLR-XXXXXX';
--               then open YOUR INVITES as that member (or: select public.my_invites(); as them).
