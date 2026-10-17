-- People of Bengaluru — founder codes vouch as "People of Bengaluru" (was "Designers of Bengaluru").
-- check_invite() unchanged otherwise. Safe to re-run.

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
    'inviter_role', coalesce(who.role, 'People of Bengaluru')
  );
end $$;

grant execute on function public.check_invite(text) to anon, authenticated;
