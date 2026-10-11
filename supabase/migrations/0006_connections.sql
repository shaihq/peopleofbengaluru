-- People of Bengaluru — CONNECT (CLAUDE.md Phase 5G)
-- Discovery → Intent → Mutual match → Introduction → Take it from here.
--
-- contacts:    one preferred contact per member. Only the owner can read or write it directly;
--              the other person sees it only through my_connections(), once both said yes.
-- connections: no client access at all. Everything goes through the functions below, so a
--              decline can never be read by the sender.

insert into public.app_settings (key, value) values
  ('connect_daily_limit', '10'),
  ('connect_expiry_days', '14'),
  ('connect_cooldown_days', '30')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------

create or replace function public.valid_contact(p_method text, p_value text) returns boolean
language sql immutable as $$
  select case p_method
    when 'whatsapp'  then p_value ~ '^\+[1-9][0-9]{7,14}$'
    when 'email'     then p_value ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' and char_length(p_value) <= 200
    when 'instagram' then p_value ~ '^[A-Za-z0-9._]{1,30}$'
    when 'telegram'  then p_value ~ '^[A-Za-z0-9_]{5,32}$'
    when 'x'         then p_value ~ '^[A-Za-z0-9_]{1,15}$'
    when 'linkedin'  then p_value ~ '^https://(www\.)?linkedin\.com/[^\s]+$' and char_length(p_value) <= 200
    else false
  end
$$;

create table if not exists public.contacts (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  method      text not null,
  value       text not null,
  -- email me when someone wants to connect / when it's a match
  emails      boolean not null default true,
  updated_at  timestamptz not null default now(),
  constraint contacts_valid check (public.valid_contact(method, value))
);

alter table public.contacts enable row level security;

create policy "own contact: read" on public.contacts for select using (auth.uid() = user_id);
create policy "own contact: insert" on public.contacts for insert with check (auth.uid() = user_id);
create policy "own contact: update" on public.contacts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own contact: delete" on public.contacts for delete using (auth.uid() = user_id);

create trigger contacts_touch before update on public.contacts
  for each row execute function public.touch_profile();

-- ---------------------------------------------------------------------------
-- connections
-- ---------------------------------------------------------------------------

create table if not exists public.connections (
  id            uuid primary key default gen_random_uuid(),
  from_id       uuid not null references public.profiles (id) on delete cascade,
  to_id         uuid not null references public.profiles (id) on delete cascade,
  intent        text not null check (intent in ('coffee', 'work', 'ideas', 'build', 'hangout')),
  status        text not null default 'pending'
                check (status in ('pending', 'accepted', 'declined', 'expired', 'withdrawn', 'removed')),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  -- the recipient has seen the request · the sender has seen the match
  to_seen_at    timestamptz,
  from_seen_at  timestamptz,
  check (from_id <> to_id)
);

-- one open request or connection per pair, whichever way round
create unique index if not exists connections_open_pair
  on public.connections (least(from_id, to_id), greatest(from_id, to_id))
  where status in ('pending', 'accepted');
create index if not exists connections_to on public.connections (to_id, status);
create index if not exists connections_from on public.connections (from_id, created_at desc);

-- RLS on, no policies: invisible to clients except through the functions below.
alter table public.connections enable row level security;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_member(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = p_id and status = 'approved')
$$;

create or replace function public.connect_setting(p_key text, p_fallback int) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::int from app_settings where key = p_key), p_fallback)
$$;

-- pending requests past their expiry become 'expired'
create or replace function public.expire_connections(p_a uuid, p_b uuid) returns void
language sql security definer set search_path = public as $$
  update connections set status = 'expired', decided_at = coalesce(decided_at, now())
   where status = 'pending'
     and created_at < now() - make_interval(days => connect_setting('connect_expiry_days', 14))
     and ((from_id = p_a and to_id = p_b) or (from_id = p_b and to_id = p_a))
$$;

-- ---------------------------------------------------------------------------
-- actions
-- ---------------------------------------------------------------------------

create or replace function public.send_connect(p_to uuid, p_intent text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r connections;
begin
  if me is null then return jsonb_build_object('ok', false, 'state', 'signed_out'); end if;
  if not is_member(me) then return jsonb_build_object('ok', false, 'state', 'not_member'); end if;
  if p_to = me then return jsonb_build_object('ok', false, 'state', 'self'); end if;
  if not is_member(p_to) then return jsonb_build_object('ok', false, 'state', 'not_found'); end if;
  if p_intent not in ('coffee', 'work', 'ideas', 'build', 'hangout') then
    return jsonb_build_object('ok', false, 'state', 'invalid');
  end if;
  if not exists (select 1 from contacts where user_id = me) then
    return jsonb_build_object('ok', false, 'state', 'no_contact');
  end if;

  perform expire_connections(me, p_to);

  select * into r from connections
   where status in ('pending', 'accepted')
     and ((from_id = me and to_id = p_to) or (from_id = p_to and to_id = me))
   limit 1;

  if found and r.status = 'accepted' then
    return jsonb_build_object('ok', false, 'state', 'connected', 'id', r.id);
  end if;
  if found and r.from_id = me then
    return jsonb_build_object('ok', false, 'state', 'already_sent', 'id', r.id);
  end if;
  if found then
    -- they already asked you: that's a match
    update connections set status = 'accepted', decided_at = now(), to_seen_at = coalesce(to_seen_at, now())
     where id = r.id;
    return jsonb_build_object('ok', true, 'state', 'matched', 'id', r.id, 'intent', r.intent, 'other', p_to);
  end if;

  -- after a request ends without a match, wait before asking the same person again
  if exists (
    select 1 from connections
     where from_id = me and to_id = p_to
       and status in ('declined', 'expired', 'withdrawn')
       and created_at > now() - make_interval(days => connect_setting('connect_cooldown_days', 30))
  ) then
    return jsonb_build_object('ok', false, 'state', 'cooldown');
  end if;

  if (select count(*) from connections where from_id = me and created_at > now() - interval '1 day')
     >= connect_setting('connect_daily_limit', 10) then
    return jsonb_build_object('ok', false, 'state', 'limit');
  end if;

  insert into connections (from_id, to_id, intent) values (me, p_to, p_intent) returning * into r;
  return jsonb_build_object('ok', true, 'state', 'sent', 'id', r.id, 'intent', r.intent, 'other', p_to);
end $$;

create or replace function public.respond_connect(p_id uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r connections;
begin
  if me is null then return jsonb_build_object('ok', false, 'state', 'signed_out'); end if;
  select * into r from connections where id = p_id and to_id = me;
  if not found then return jsonb_build_object('ok', false, 'state', 'not_found'); end if;
  perform expire_connections(r.from_id, r.to_id);
  select * into r from connections where id = p_id;
  if r.status <> 'pending' then return jsonb_build_object('ok', false, 'state', r.status); end if;
  if p_accept and not exists (select 1 from contacts where user_id = me) then
    return jsonb_build_object('ok', false, 'state', 'no_contact');
  end if;
  if p_accept and not is_member(r.from_id) then
    return jsonb_build_object('ok', false, 'state', 'not_found');
  end if;

  update connections
     set status = case when p_accept then 'accepted' else 'declined' end,
         decided_at = now(),
         to_seen_at = coalesce(to_seen_at, now())
   where id = p_id;
  return jsonb_build_object('ok', true, 'state', case when p_accept then 'matched' else 'declined' end,
                            'id', p_id, 'intent', r.intent, 'other', r.from_id);
end $$;

create or replace function public.withdraw_connect(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update connections set status = 'withdrawn', decided_at = now()
   where id = p_id and from_id = auth.uid() and status = 'pending';
  return jsonb_build_object('ok', found);
end $$;

create or replace function public.remove_connect(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update connections set status = 'removed', decided_at = now()
   where id = p_id and auth.uid() in (from_id, to_id) and status = 'accepted';
  return jsonb_build_object('ok', found);
end $$;

-- Everything you can see about your connections. The ONLY place a contact is revealed:
-- both people said yes, and the other person is still a member.
create or replace function public.my_connections() returns jsonb
language sql stable security definer set search_path = public as $$
  with mine as (
    select c.*,
           case when c.from_id = auth.uid() then 'out' else 'in' end as dir,
           case when c.from_id = auth.uid() then c.to_id else c.from_id end as other_id,
           c.created_at < now() - make_interval(days => connect_setting('connect_expiry_days', 14)) as stale
      from connections c
     where auth.uid() in (c.from_id, c.to_id)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', m.id,
           'dir', m.dir,
           'intent', m.intent,
           'state', case when m.status = 'accepted' then 'matched' else 'pending' end,
           'created_at', m.created_at,
           'decided_at', case when m.status = 'accepted' then m.decided_at end,
           'seen', case when m.status = 'accepted' and m.dir = 'out' then m.from_seen_at is not null
                        when m.dir = 'in' then m.to_seen_at is not null
                        else true end,
           'other', jsonb_build_object('id', p.id, 'name', p.name, 'role', p.role, 'character', p.character, 'location', p.location),
           'contact', case when m.status = 'accepted'
                           then (select jsonb_build_object('method', k.method, 'value', k.value)
                                   from contacts k where k.user_id = m.other_id) end
         ) order by coalesce(m.decided_at, m.created_at) desc), '[]'::jsonb)
    from mine m
    join profiles p on p.id = m.other_id and p.status = 'approved'
   where m.status = 'accepted'
      -- open requests; a decline looks exactly like silence to the sender
      or (m.status = 'pending' and not m.stale)
      or (m.status = 'declined' and m.dir = 'out' and not m.stale)
$$;

create or replace function public.mark_connections_seen() returns void
language sql security definer set search_path = public as $$
  update connections set to_seen_at = now()
   where to_id = auth.uid() and status = 'pending' and to_seen_at is null;
  update connections set from_seen_at = now()
   where from_id = auth.uid() and status = 'accepted' and from_seen_at is null;
$$;

revoke execute on function public.send_connect(uuid, text), public.respond_connect(uuid, boolean),
  public.withdraw_connect(uuid), public.remove_connect(uuid), public.my_connections(),
  public.mark_connections_seen(), public.expire_connections(uuid, uuid) from anon, public;
grant execute on function public.send_connect(uuid, text), public.respond_connect(uuid, boolean),
  public.withdraw_connect(uuid), public.remove_connect(uuid), public.my_connections(),
  public.mark_connections_seen() to authenticated;
revoke execute on function public.expire_connections(uuid, uuid) from authenticated;
