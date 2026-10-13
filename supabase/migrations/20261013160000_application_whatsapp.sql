-- People of Bengaluru — an optional WhatsApp number on the application (CLAUDE.md 5E).
-- Asked on the email step of Apply to join, so a reviewer can reach the applicant. It lives only on the
-- application (applicant + admins can read it, same RLS as the answers); it is never copied to the profile
-- and never shown in the city.
--
-- Additive and backward compatible: the old client simply doesn't send it. Safe to re-run.

alter table public.applications add column if not exists whatsapp text
  check (whatsapp ~ '^\+[1-9][0-9]{7,14}$');

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
        want = trim(p_answers ->> 'want'),
        bring = trim(p_answers ->> 'bring'),
        show_link = trim(p_answers ->> 'show_link'),
        show_why = trim(p_answers ->> 'show_why'),
        whatsapp = wa,
        profile = p_profile,
        status = 'submitted'
      where id = cur.id;
      new_id := cur.id;
    else
      insert into public.applications (user_id, email, why, want, bring, show_link, show_why, whatsapp, profile)
      values (
        uid, mail,
        trim(p_answers ->> 'why'),
        trim(p_answers ->> 'want'),
        trim(p_answers ->> 'bring'),
        trim(p_answers ->> 'show_link'),
        trim(p_answers ->> 'show_why'),
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
