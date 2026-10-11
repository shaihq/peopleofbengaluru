-- People of Bengaluru — CONNECT: an optional note on a request (CLAUDE.md Phase 5G)
-- One line from the sender (≤ 200 characters), shown to the person asked: in the city and in the
-- request email. Still no chat: it is sent once, with the request, and never replied to.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table public.connections add column if not exists note text check (char_length(note) <= 200);

-- send_connect gains p_note (default null, so callers that don't send one keep working)
drop function if exists public.send_connect(uuid, text);

create or replace function public.send_connect(p_to uuid, p_intent text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r connections;
  v_note text := left(nullif(btrim(coalesce(p_note, '')), ''), 200);
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
    -- they already asked you: that's a match (your note isn't needed any more)
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

  insert into connections (from_id, to_id, intent, note) values (me, p_to, p_intent, v_note) returning * into r;
  return jsonb_build_object('ok', true, 'state', 'sent', 'id', r.id, 'intent', r.intent, 'other', p_to, 'note', r.note);
end $$;

revoke execute on function public.send_connect(uuid, text, text) from anon, public;
grant execute on function public.send_connect(uuid, text, text) to authenticated;

-- my_connections: + note (both people in the request see it)
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
           'note', m.note,
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
