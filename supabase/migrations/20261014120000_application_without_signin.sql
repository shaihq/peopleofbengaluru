-- People of Bengaluru — APPLY WITHOUT SIGNING IN (CLAUDE.md Phase 5E, while applications are free)
-- With no payment there is nothing to tie to a verified account, so the applicant no longer confirms
-- their email first. /api/apply/submit (service role) finds or creates the account for that email and
-- puts the application straight into the review queue. The magic link comes later, to sign in once approved.
--
-- Safe to re-run.

create or replace function public.submit_application_for(p_email text, p_answers jsonb, p_profile jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid;
  mail text;
  confirmed timestamptz;
  cur public.applications;
  new_id uuid;
  wa text := nullif(trim(coalesce(p_answers ->> 'whatsapp', '')), '');
begin
  select id, email, email_confirmed_at into uid, mail, confirmed from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if uid is null then
    return jsonb_build_object('ok', false, 'state', 'no_user');
  end if;

  if exists (select 1 from public.profiles where id = uid and status = 'approved') then
    return jsonb_build_object('ok', false, 'state', 'member');
  end if;

  -- nobody signed in here, so never touch an account someone has proven: they apply signed in
  if confirmed is not null then
    return jsonb_build_object('ok', false, 'state', 'signin_required');
  end if;

  if char_length(coalesce(p_profile ->> 'name', '')) < 2 or char_length(coalesce(p_profile ->> 'role', '')) < 2 then
    return jsonb_build_object('ok', false, 'state', 'invalid');
  end if;

  select * into cur from public.applications
    where user_id = uid and status not in ('rejected', 'refunded')
    for update;

  -- an open application is never rewritten from outside: the reviewer keeps what was sent
  if cur.id is not null then
    return jsonb_build_object('ok', false, 'state',
      case when cur.status in ('draft', 'submitted') then 'signin_required' else 'in_review' end);
  end if;

  begin
    insert into public.applications (user_id, email, why, whatsapp, profile, status)
    values (uid, mail, trim(p_answers ->> 'why'), wa, p_profile, 'under_review')
    returning id into new_id;
  exception when check_violation or not_null_violation then
    return jsonb_build_object('ok', false, 'state', 'invalid');
  end;

  return jsonb_build_object('ok', true, 'id', new_id, 'status', 'under_review');
end $$;

-- the server only: anyone could otherwise apply in someone else's name without the route's checks
revoke execute on function public.submit_application_for(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.submit_application_for(text, jsonb, jsonb) to service_role;
