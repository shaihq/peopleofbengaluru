-- People of Bengaluru — FOUNDER INVITES IN /admin (CLAUDE.md Phase 5D). Admins mint founder codes
-- (no owner) in batches with a label, see each one's state and who joined with it, rename the label
-- (who it went to) and revoke a code that hasn't been used. Every function checks is_admin() itself.
--
-- Safe to re-run.

-- Mint p_n founder codes (1–200), all with the same label.
create or replace function public.admin_issue_invites(p_n int, p_note text default null) returns setof text
language plpgsql volatile security definer set search_path = public as $$
declare
  c text;
  n text := left(nullif(trim(coalesce(p_note, '')), ''), 120);
begin
  if not is_admin() then raise exception 'admins only'; end if;
  if p_n is null or p_n < 1 or p_n > 200 then raise exception 'between 1 and 200 codes at a time'; end if;
  for c in select * from public.issue_invites(null, p_n) loop
    if n is not null then update invites set note = n where code = c; end if;
    return next c;
  end loop;
end $$;

-- Every founder code, newest first, with who joined with it.
create or replace function public.admin_founder_invites()
returns table (code text, state text, note text, created_at timestamptz, used_at timestamptz,
               used_by uuid, used_name text, used_role text, used_status text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admins only'; end if;
  return query
    select i.code, i.state, i.note, i.created_at, i.used_at, i.used_by, p.name, p.role, p.status
      from invites i
      left join profiles p on p.id = i.used_by
     where i.owner is null
     order by i.created_at desc, i.code;
end $$;

-- Who a founder code went to (or the batch label). Empty clears it.
create or replace function public.admin_set_invite_note(p_code text, p_note text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admins only'; end if;
  update invites set note = left(nullif(trim(coalesce(p_note, '')), ''), 120)
   where code = upper(trim(p_code)) and owner is null;
  return jsonb_build_object('ok', found);
end $$;

-- Kill a founder code that hasn't been used (it then answers "invalid" at the gate).
create or replace function public.admin_revoke_invite(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admins only'; end if;
  update invites set state = 'revoked'
   where code = upper(trim(p_code)) and owner is null and state in ('available', 'sent');
  return jsonb_build_object('ok', found);
end $$;

revoke execute on function
  public.admin_issue_invites(int, text), public.admin_founder_invites(),
  public.admin_set_invite_note(text, text), public.admin_revoke_invite(text)
from public, anon;

grant execute on function
  public.admin_issue_invites(int, text), public.admin_founder_invites(),
  public.admin_set_invite_note(text, text), public.admin_revoke_invite(text)
to authenticated;
