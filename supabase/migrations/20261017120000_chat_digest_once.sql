-- People of Bengaluru — CHAT DIGEST: one email per batch of unread messages (CLAUDE.md 5G)
-- Bug: chat_digest_due() re-sent "X sent you a message" every 6 hours for as long as the messages
-- stayed unread (up to 7 days), about the same old messages. Now a chat is due only when a message
-- arrived after the last email (and still at most once per 6 hours). Safe to re-run.

create or replace function public.chat_digest_due(p_min_age interval default '10 minutes', p_gap interval default '6 hours')
returns table (connection_id uuid, recipient_id uuid, sender_id uuid, sender_name text, unread int)
language sql stable security definer set search_path = public as $$
  select c.id, side.recipient, side.sender, p.name, u.unread::int
    from connections c
    cross join lateral (
      values (c.to_id, c.from_id, c.to_read_at, c.to_emailed_at), (c.from_id, c.to_id, c.from_read_at, c.from_emailed_at)
    ) as side (recipient, sender, read_at, emailed_at)
    cross join lateral (
      select count(*) as unread, min(x.created_at) as first_at, max(x.created_at) as last_at
        from messages x
       where x.connection_id = c.id and x.sender_id = side.sender
         and x.created_at > coalesce(side.read_at, '-infinity'::timestamptz)
    ) u
    join profiles p on p.id = side.sender and p.status = 'approved'
   where c.status = 'accepted'
     and c.last_message_at > now() - interval '7 days'
     and u.unread > 0
     and u.first_at < now() - p_min_age
     -- something new since the last email, and not more than once per p_gap
     and (side.emailed_at is null or (u.last_at > side.emailed_at and side.emailed_at < now() - p_gap))
     and coalesce((select ms.emails from member_settings ms where ms.user_id = side.recipient), true)
     and is_member(side.recipient)
   limit 200
$$;

revoke execute on function public.chat_digest_due(interval, interval) from public, anon, authenticated;
grant execute on function public.chat_digest_due(interval, interval) to service_role;
