-- People of Bengaluru — CHAT (CLAUDE.md Phase 5G): a match opens a 1:1 chat inside the city,
-- replacing the contact handoff. Only matched members can write; unmatch or block deletes the
-- thread for both; admins never read threads, only what someone reported.
--
-- PHASE A, additive. Dev and production share this database and the live site still runs the old
-- code, so nothing old is changed in a way it would notice: the new behaviour lives in *_v2
-- functions. Phase B (0010_drop_contacts.sql) removes contacts + the old functions once production
-- runs the new code.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

-- ---------------------------------------------------------------------------
-- email preference (was contacts.emails; contacts go away in phase B)
-- ---------------------------------------------------------------------------

create table if not exists public.member_settings (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  -- email me about connect requests, matches and unread messages
  emails      boolean not null default true,
  updated_at  timestamptz not null default now()
);

alter table public.member_settings enable row level security;

drop policy if exists "own settings: read" on public.member_settings;
drop policy if exists "own settings: insert" on public.member_settings;
drop policy if exists "own settings: update" on public.member_settings;
create policy "own settings: read" on public.member_settings for select using (auth.uid() = user_id);
create policy "own settings: insert" on public.member_settings for insert with check (auth.uid() = user_id);
create policy "own settings: update" on public.member_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists member_settings_touch on public.member_settings;
create trigger member_settings_touch before update on public.member_settings
  for each row execute function public.touch_profile();

insert into public.member_settings (user_id, emails)
  select user_id, emails from public.contacts
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- threads: one per accepted connection
-- ---------------------------------------------------------------------------

alter table public.connections add column if not exists last_message_at timestamptz;
-- each side's last read, and the last unread-message email to each side
alter table public.connections add column if not exists from_read_at timestamptz;
alter table public.connections add column if not exists to_read_at timestamptz;
alter table public.connections add column if not exists from_emailed_at timestamptz;
alter table public.connections add column if not exists to_emailed_at timestamptz;

create table if not exists public.messages (
  id             uuid primary key default gen_random_uuid(),
  connection_id  uuid not null references public.connections (id) on delete cascade,
  sender_id      uuid not null references public.profiles (id) on delete cascade,
  body           text not null check (char_length(body) between 1 and 500),
  created_at     timestamptz not null default now()
);

create index if not exists messages_thread on public.messages (connection_id, created_at desc);
create index if not exists messages_sender on public.messages (sender_id, created_at desc);

-- RLS on, no policies: read and written only through the functions below.
alter table public.messages enable row level security;

-- ---------------------------------------------------------------------------
-- blocks and reports
-- ---------------------------------------------------------------------------

create table if not exists public.blocks (
  blocker_id  uuid not null references public.profiles (id) on delete cascade,
  blocked_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;

create table if not exists public.reports (
  id             uuid primary key default gen_random_uuid(),
  reporter_id    uuid references public.profiles (id) on delete set null,
  reported_id    uuid references public.profiles (id) on delete set null,
  -- what the reporter saw, copied before the thread is deleted: the request + the last messages
  snapshot       jsonb not null,
  reason         text check (char_length(reason) <= 500),
  status         text not null default 'open' check (status in ('open', 'resolved', 'hidden')),
  resolved_by    uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz
);
create index if not exists reports_open on public.reports (status, created_at desc);
alter table public.reports enable row level security;

drop policy if exists "admins read reports" on public.reports;
create policy "admins read reports" on public.reports for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_blocked(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a))
$$;

-- the accepted connection p_conn, if the caller is in it and the other person is still a member
create or replace function public.my_thread(p_conn uuid) returns connections
language sql stable security definer set search_path = public as $$
  select c.* from connections c
   where c.id = p_conn and c.status = 'accepted' and auth.uid() in (c.from_id, c.to_id)
     and is_member(case when c.from_id = auth.uid() then c.to_id else c.from_id end)
$$;

-- ---------------------------------------------------------------------------
-- connect, v2: no contact needed any more; blocks respected (a block reads as "not found")
-- ---------------------------------------------------------------------------

create or replace function public.send_connect_v2(p_to uuid, p_intent text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r connections;
  v_note text := left(nullif(btrim(coalesce(p_note, '')), ''), 200);
begin
  if me is null then return jsonb_build_object('ok', false, 'state', 'signed_out'); end if;
  if not is_member(me) then return jsonb_build_object('ok', false, 'state', 'not_member'); end if;
  if p_to = me then return jsonb_build_object('ok', false, 'state', 'self'); end if;
  if not is_member(p_to) or is_blocked(me, p_to) then return jsonb_build_object('ok', false, 'state', 'not_found'); end if;
  if p_intent not in ('coffee', 'work', 'ideas', 'build', 'hangout') then
    return jsonb_build_object('ok', false, 'state', 'invalid');
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
    -- they already asked you: that's a match (your note isn't needed any more)
    update connections set status = 'accepted', decided_at = now(), to_seen_at = coalesce(to_seen_at, now())
     where id = r.id;
    return jsonb_build_object('ok', true, 'state', 'matched', 'id', r.id, 'intent', r.intent, 'other', p_to);
  end if;

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

  insert into connections (from_id, to_id, intent, note) values (me, p_to, p_intent, v_note) returning * into r;
  return jsonb_build_object('ok', true, 'state', 'sent', 'id', r.id, 'intent', r.intent, 'other', p_to, 'note', r.note);
end $$;

create or replace function public.respond_connect_v2(p_id uuid, p_accept boolean) returns jsonb
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
  if p_accept and (not is_member(r.from_id) or is_blocked(me, r.from_id)) then
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

-- unmatch: the thread is deleted for both (the old function, same signature, now also clears messages)
create or replace function public.remove_connect(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update connections set status = 'removed', decided_at = now()
   where id = p_id and auth.uid() in (from_id, to_id) and status = 'accepted';
  if found then delete from messages where connection_id = p_id; end if;
  return jsonb_build_object('ok', found);
end $$;

-- Everything you see about your connections: requests, matches (with unread + last message), sent.
create or replace function public.my_connections_v2() returns jsonb
language sql stable security definer set search_path = public as $$
  with mine as (
    select c.*,
           case when c.from_id = auth.uid() then 'out' else 'in' end as dir,
           case when c.from_id = auth.uid() then c.to_id else c.from_id end as other_id,
           case when c.from_id = auth.uid() then c.from_read_at else c.to_read_at end as my_read_at,
           c.created_at < now() - make_interval(days => connect_setting('connect_expiry_days', 14)) as stale
      from connections c
     where auth.uid() in (c.from_id, c.to_id)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', m.id,
           'dir', m.dir,
           'intent', m.intent,
           'note', m.note,
           'state', case when m.status = 'accepted' then 'matched' else 'pending' end,
           'created_at', m.created_at,
           'decided_at', case when m.status = 'accepted' then m.decided_at end,
           'seen', case when m.status = 'accepted' and m.dir = 'out' then m.from_seen_at is not null
                        when m.dir = 'in' then m.to_seen_at is not null
                        else true end,
           'other', jsonb_build_object('id', p.id, 'name', p.name, 'role', p.role, 'character', p.character, 'location', p.location),
           'last_message_at', m.last_message_at,
           'unread', case when m.status = 'accepted' then
                       (select count(*) from messages x
                         where x.connection_id = m.id and x.sender_id <> auth.uid()
                           and x.created_at > coalesce(m.my_read_at, '-infinity'::timestamptz))
                     else 0 end,
           'last', case when m.status = 'accepted' then
                     (select jsonb_build_object('body', left(x.body, 120), 'mine', x.sender_id = auth.uid(), 'at', x.created_at)
                        from messages x where x.connection_id = m.id order by x.created_at desc limit 1) end
         ) order by coalesce(m.last_message_at, m.decided_at, m.created_at) desc), '[]'::jsonb)
    from mine m
    join profiles p on p.id = m.other_id and p.status = 'approved'
   where not is_blocked(auth.uid(), m.other_id)
     and (m.status = 'accepted'
      -- open requests; a decline looks exactly like silence to the sender
      or (m.status = 'pending' and not m.stale)
      or (m.status = 'declined' and m.dir = 'out' and not m.stale))
$$;

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------

create or replace function public.send_message(p_conn uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  c connections;
  v_body text := btrim(coalesce(p_body, ''));
  m messages;
begin
  if me is null then return jsonb_build_object('ok', false, 'state', 'signed_out'); end if;
  if not is_member(me) then return jsonb_build_object('ok', false, 'state', 'not_member'); end if;
  c := my_thread(p_conn);
  if c.id is null or is_blocked(c.from_id, c.to_id) then return jsonb_build_object('ok', false, 'state', 'not_found'); end if;
  if char_length(v_body) = 0 then return jsonb_build_object('ok', false, 'state', 'empty'); end if;
  if char_length(v_body) > 500 then return jsonb_build_object('ok', false, 'state', 'too_long'); end if;
  if (select count(*) from messages where sender_id = me and created_at > now() - interval '1 minute') >= 30 then
    return jsonb_build_object('ok', false, 'state', 'slow_down');
  end if;

  insert into messages (connection_id, sender_id, body) values (c.id, me, v_body) returning * into m;
  update connections
     set last_message_at = m.created_at,
         from_read_at = case when from_id = me then m.created_at else from_read_at end,
         to_read_at   = case when to_id = me then m.created_at else to_read_at end
   where id = c.id;
  return jsonb_build_object('ok', true, 'state', 'sent', 'message',
    jsonb_build_object('id', m.id, 'connection_id', m.connection_id, 'sender_id', m.sender_id, 'body', m.body, 'created_at', m.created_at));
end $$;

-- the newest p_limit messages before p_before (oldest first), for one of your threads
create or replace function public.thread_messages(p_conn uuid, p_before timestamptz default null, p_limit int default 50) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'connection_id', x.connection_id, 'sender_id', x.sender_id,
                                               'body', x.body, 'created_at', x.created_at) order by x.created_at), '[]'::jsonb)
    from (select * from messages
           where connection_id = (my_thread(p_conn)).id
             and created_at < coalesce(p_before, 'infinity'::timestamptz)
           order by created_at desc
           limit least(greatest(coalesce(p_limit, 50), 1), 100)) x
$$;

create or replace function public.mark_read(p_conn uuid) returns void
language sql security definer set search_path = public as $$
  update connections
     set from_read_at = case when from_id = auth.uid() then now() else from_read_at end,
         to_read_at   = case when to_id = auth.uid() then now() else to_read_at end
   where id = p_conn and status = 'accepted' and auth.uid() in (from_id, to_id)
$$;

-- ---------------------------------------------------------------------------
-- block, report, admin
-- ---------------------------------------------------------------------------

-- Ends anything open between you, deletes the thread for both, and stops either asking again.
create or replace function public.block_member(p_other uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null or p_other is null or p_other = me then return jsonb_build_object('ok', false); end if;
  insert into blocks (blocker_id, blocked_id) values (me, p_other) on conflict do nothing;
  delete from messages where connection_id in (
    select id from connections where (from_id = me and to_id = p_other) or (from_id = p_other and to_id = me));
  update connections set status = 'removed', decided_at = now()
   where status in ('pending', 'accepted')
     and ((from_id = me and to_id = p_other) or (from_id = p_other and to_id = me));
  return jsonb_build_object('ok', true);
end $$;

-- Copies what you saw (the request + the last 20 messages) for the admins, then blocks them.
create or replace function public.report_member(p_conn uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  c connections;
  v_other uuid;
begin
  select * into c from connections where id = p_conn and me in (from_id, to_id);
  if not found then return jsonb_build_object('ok', false, 'state', 'not_found'); end if;
  v_other := case when c.from_id = me then c.to_id else c.from_id end;
  insert into reports (reporter_id, reported_id, reason, snapshot) values (
    me, v_other, left(nullif(btrim(coalesce(p_reason, '')), ''), 500),
    jsonb_build_object(
      'connection', jsonb_build_object('id', c.id, 'from_id', c.from_id, 'to_id', c.to_id, 'intent', c.intent,
                                       'note', c.note, 'status', c.status, 'created_at', c.created_at),
      'reported', (select jsonb_build_object('id', p.id, 'name', p.name, 'role', p.role) from profiles p where p.id = v_other),
      'messages', (select coalesce(jsonb_agg(jsonb_build_object('from', x.sender_id, 'body', x.body, 'at', x.created_at) order by x.created_at), '[]'::jsonb)
                     from (select * from messages where connection_id = c.id order by created_at desc limit 20) x)));
  perform block_member(v_other);
  return jsonb_build_object('ok', true);
end $$;

-- Admins: close a report; with p_hide the reported member leaves the city (profiles.status = hidden).
create or replace function public.admin_resolve_report(p_id uuid, p_hide boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r reports;
begin
  if not is_admin() then raise exception 'admins only'; end if;
  update reports set status = case when p_hide then 'hidden' else 'resolved' end,
                     resolved_by = auth.uid(), resolved_at = now()
   where id = p_id returning * into r;
  if not found then return jsonb_build_object('ok', false); end if;
  if p_hide and r.reported_id is not null then
    update profiles set status = 'hidden' where id = r.reported_id;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- unread-message emails (called by the server with the service key, from /api/cron/chat-digest)
-- ---------------------------------------------------------------------------

-- Each person with messages unread for at least p_min_age in a thread, not emailed about that thread
-- within p_gap: who to email, from whom, how many.
create or replace function public.chat_digest_due(p_min_age interval default '10 minutes', p_gap interval default '6 hours')
returns table (connection_id uuid, recipient_id uuid, sender_id uuid, sender_name text, unread int)
language sql stable security definer set search_path = public as $$
  select c.id, side.recipient, side.sender, p.name, u.unread::int
    from connections c
    cross join lateral (
      values (c.to_id, c.from_id, c.to_read_at, c.to_emailed_at), (c.from_id, c.to_id, c.from_read_at, c.from_emailed_at)
    ) as side (recipient, sender, read_at, emailed_at)
    cross join lateral (
      select count(*) as unread, min(x.created_at) as first_at
        from messages x
       where x.connection_id = c.id and x.sender_id = side.sender
         and x.created_at > coalesce(side.read_at, '-infinity'::timestamptz)
    ) u
    join profiles p on p.id = side.sender and p.status = 'approved'
   where c.status = 'accepted'
     and c.last_message_at > now() - interval '7 days'
     and u.unread > 0
     and u.first_at < now() - p_min_age
     and (side.emailed_at is null or side.emailed_at < now() - p_gap)
     and coalesce((select ms.emails from member_settings ms where ms.user_id = side.recipient), true)
     and is_member(side.recipient)
   limit 200
$$;

create or replace function public.chat_mark_emailed(p_conn uuid, p_recipient uuid) returns void
language sql security definer set search_path = public as $$
  update connections
     set from_emailed_at = case when from_id = p_recipient then now() else from_emailed_at end,
         to_emailed_at   = case when to_id = p_recipient then now() else to_emailed_at end
   where id = p_conn
$$;

-- ---------------------------------------------------------------------------
-- realtime: each member listens on their own private topic "user:<id>"
-- ---------------------------------------------------------------------------

drop policy if exists "members hear their own topic" on realtime.messages;
create policy "members hear their own topic" on realtime.messages for select to authenticated
  using (realtime.topic() = 'user:' || auth.uid()::text);

-- never let a realtime hiccup fail the write that triggered it
create or replace function public.notify_user(p_user uuid, p_event text, p_payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send(p_payload, p_event, 'user:' || p_user::text, true);
exception when others then
  raise warning 'notify_user failed: %', sqlerrm;
end $$;

create or replace function public.messages_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c connections;
  v jsonb := jsonb_build_object('id', new.id, 'connection_id', new.connection_id, 'sender_id', new.sender_id,
                                'body', new.body, 'created_at', new.created_at);
begin
  select * into c from connections where id = new.connection_id;
  perform notify_user(c.from_id, 'message', v);
  perform notify_user(c.to_id, 'message', v);
  return null;
end $$;

drop trigger if exists messages_notify on public.messages;
create trigger messages_notify after insert on public.messages
  for each row execute function public.messages_notify();

-- requests, matches, unmatches: just "look again" (the list itself comes from my_connections_v2)
create or replace function public.connections_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform notify_user(new.to_id, 'connections', jsonb_build_object('id', new.id));
  elsif new.status is distinct from old.status then
    perform notify_user(new.from_id, 'connections', jsonb_build_object('id', new.id));
    perform notify_user(new.to_id, 'connections', jsonb_build_object('id', new.id));
  end if;
  return null;
end $$;

drop trigger if exists connections_notify on public.connections;
create trigger connections_notify after insert or update of status on public.connections
  for each row execute function public.connections_notify();

-- ---------------------------------------------------------------------------
-- grants
-- ---------------------------------------------------------------------------

revoke execute on function
  public.is_blocked(uuid, uuid), public.my_thread(uuid),
  public.send_connect_v2(uuid, text, text), public.respond_connect_v2(uuid, boolean),
  public.my_connections_v2(), public.send_message(uuid, text), public.thread_messages(uuid, timestamptz, int),
  public.mark_read(uuid), public.block_member(uuid), public.report_member(uuid, text),
  public.admin_resolve_report(uuid, boolean),
  public.chat_digest_due(interval, interval), public.chat_mark_emailed(uuid, uuid),
  public.notify_user(uuid, text, jsonb), public.messages_notify(), public.connections_notify()
from anon, authenticated, public;

grant execute on function
  public.send_connect_v2(uuid, text, text), public.respond_connect_v2(uuid, boolean),
  public.my_connections_v2(), public.send_message(uuid, text), public.thread_messages(uuid, timestamptz, int),
  public.mark_read(uuid), public.block_member(uuid), public.report_member(uuid, text),
  public.admin_resolve_report(uuid, boolean)
to authenticated;

grant execute on function public.chat_digest_due(interval, interval), public.chat_mark_emailed(uuid, uuid) to service_role;

revoke all on public.blocks, public.messages from anon, authenticated;
revoke insert, update, delete on public.reports from anon, authenticated;
