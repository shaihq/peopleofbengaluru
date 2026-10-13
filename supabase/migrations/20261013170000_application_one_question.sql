-- People of Bengaluru — the application asks one question now (CLAUDE.md 5E): WHY HERE?
-- The other three (looking for, will bring, show us one thing) are gone: their columns are dropped
-- (existing answers in them are deleted) and submit_application no longer writes them.
--
-- Safe to re-run.

alter table public.applications
  drop column if exists want,
  drop column if exists bring,
  drop column if exists show_link,
  drop column if exists show_why;

create or replace function public.submit_application(p_answers jsonb, p_profile jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mail text := auth.jwt() ->> 'email';
  cur public.applications;
  new_id uuid;
  wa text := nullif(trim(coalesce(p_answers ->> 'whatsapp', '')), '');
begin
  if uid is null or mail is null then
    return jsonb_build_object('ok', false, 'state', 'signed_out');
  end if;

  -- already in the city: nothing to apply for
  if exists (select 1 from public.profiles where id = uid and status = 'approved') then
    return jsonb_build_object('ok', false, 'state', 'member');
  end if;

  if char_length(coalesce(p_profile ->> 'name', '')) < 2 or char_length(coalesce(p_profile ->> 'role', '')) < 2 then
    return jsonb_build_object('ok', false, 'state', 'invalid');
  end if;

  select * into cur from public.applications
    where user_id = uid and status not in ('rejected', 'refunded')
    for update;

  if cur.id is not null and cur.status not in ('draft', 'submitted') then
    -- paid: the reviewer is looking at exactly what was paid for
    return jsonb_build_object('ok', false, 'state', 'in_review', 'status', cur.status);
  end if;

  begin
    if cur.id is not null then
      update public.applications set
        email = mail,
        why = trim(p_answers ->> 'why'),
        whatsapp = wa,
        profile = p_profile,
        status = 'submitted'
      where id = cur.id;
      new_id := cur.id;
    else
      insert into public.applications (user_id, email, why, whatsapp, profile)
      values (
        uid, mail,
        trim(p_answers ->> 'why'),
        wa,
        p_profile
      )
      returning id into new_id;
    end if;
  exception when check_violation or not_null_violation then
    return jsonb_build_object('ok', false, 'state', 'invalid');
  end;

  return jsonb_build_object('ok', true, 'id', new_id, 'status', 'submitted');
end $$;

revoke execute on function public.submit_application(jsonb, jsonb) from public, anon;
grant execute on function public.submit_application(jsonb, jsonb) to authenticated;
