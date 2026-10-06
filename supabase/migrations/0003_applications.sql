-- Designers of Bengaluru — APPLY TO JOIN (CLAUDE.md Phase 5E-A)
-- The paid way in. An applicant builds their profile, answers four questions, and the
-- application is saved here BEFORE payment. Payment (Dodo) and the admin review page come
-- in 5E-B; this migration already has the columns and states they need.
--
-- Run once in the Supabase SQL editor, after 0001 and 0002. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Admins (reviewers). Added by hand:  insert into public.admins (user_id)
--   select id from auth.users where email = 'you@example.com';
-- ---------------------------------------------------------------------------

create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Applications
-- ---------------------------------------------------------------------------

create table if not exists public.applications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  email       text not null check (char_length(email) <= 254),

  -- the four questions
  why         text not null check (char_length(why) between 20 and 400),     -- WHY HERE?
  want        text not null check (char_length(want) between 20 and 400),    -- WHAT ARE YOU LOOKING FOR?
  bring       text not null check (char_length(bring) between 20 and 400),   -- WHAT WILL YOU BRING?
  show_link   text not null check (show_link ~ '^https://[^\s]+$' and char_length(show_link) <= 200), -- SHOW US ONE THING
  show_why    text not null check (char_length(show_why) between 10 and 200),

  -- the profile they built, exactly as the reviewer sees it; becomes their profile on approval
  profile     jsonb not null,

  status      text not null default 'submitted' check (status in (
                'draft', 'submitted', 'paid', 'under_review', 'approved', 'rejected', 'refunded', 'refund_failed')),

  -- 5E-B: Dodo Payments + review
  payment_id  text,
  amount      int check (amount >= 0),
  currency    text check (char_length(currency) = 3),
  reviewer    uuid references auth.users (id) on delete set null,
  reason      text check (char_length(reason) <= 400),
  paid_at     timestamptz,
  decided_at  timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One open application per person (= per email: one account per email).
create unique index if not exists applications_one_open
  on public.applications (user_id) where status not in ('rejected', 'refunded');
create index if not exists applications_queue on public.applications (status, created_at);

alter table public.applications enable row level security;

-- Applicants see their own; reviewers see all. Answers are never public.
drop policy if exists "read own or admin" on public.applications;
create policy "read own or admin" on public.applications for select
  using (auth.uid() = user_id or public.is_admin());

-- Nobody writes directly: submit_application() below (and 5E-B's server code) do.
-- So nobody can set their own status.
revoke insert, update, delete on public.applications from anon, authenticated;

drop trigger if exists applications_touch on public.applications;
create trigger applications_touch before update on public.applications
  for each row execute function public.touch_profile();

-- ---------------------------------------------------------------------------
-- submit_application(answers, profile)
-- Signed-in only (the magic link confirmed the email). Creates the application, or
-- updates it while it is still unpaid. Returns:
--   { ok: true, id, status }
--   { ok: false, state: signed_out | member | in_review | invalid }
-- ---------------------------------------------------------------------------

create or replace function public.submit_application(p_answers jsonb, p_profile jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mail text := auth.jwt() ->> 'email';
  cur public.applications;
  new_id uuid;
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
        profile = p_profile,
        status = 'submitted'
      where id = cur.id;
      new_id := cur.id;
    else
      insert into public.applications (user_id, email, why, want, bring, show_link, show_why, profile)
      values (
        uid, mail,
        trim(p_answers ->> 'why'),
        trim(p_answers ->> 'want'),
        trim(p_answers ->> 'bring'),
        trim(p_answers ->> 'show_link'),
        trim(p_answers ->> 'show_why'),
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

-- ---------------------------------------------------------------------------
-- Admin cheatsheet (run in the SQL editor)
-- ---------------------------------------------------------------------------
-- Make yourself a reviewer:   insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';
-- See the applications:       select created_at, email, status, profile ->> 'name' as name, why, want, bring, show_link from public.applications order by created_at desc;
