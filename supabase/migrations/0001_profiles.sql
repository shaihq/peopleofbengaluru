-- Designers of Bengaluru — player profiles
-- One row per signed-in person. New profiles start 'pending'; an admin flips
-- status to 'approved' (Supabase table editor) before anyone else can see them.

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  name          text not null check (char_length(name) between 2 and 40),
  role          text not null check (char_length(role) between 2 and 60),
  company       text check (char_length(company) <= 60),
  location      text not null default 'Koramangala' check (char_length(location) <= 40),
  building      text check (char_length(building) <= 80),
  previously    text check (char_length(previously) <= 80),
  open_to_work  boolean not null default false,
  skills        text[] not null default '{}' check (cardinality(skills) <= 6),
  portfolio     text check (portfolio ~ '^https://[^\s]+$' and char_length(portfolio) <= 200),
  linkedin      text check (linkedin ~ '^https://(www\.)?linkedin\.com/[^\s]+$' and char_length(linkedin) <= 200),
  x             text check (x ~ '^https://(x|twitter)\.com/[A-Za-z0-9_]{1,15}/?$'),
  character     text not null default 'designer' check (char_length(character) <= 30),
  spot          text not null default 'junction' check (char_length(spot) <= 30),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'hidden')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Everyone (including guests) sees approved profiles; you always see your own.
drop policy if exists "profiles are readable when approved or own" on public.profiles;
create policy "profiles are readable when approved or own"
  on public.profiles for select
  using (status = 'approved' or auth.uid() = id);

-- You can only create your own row, and it must start pending.
drop policy if exists "insert own pending profile" on public.profiles;
create policy "insert own pending profile"
  on public.profiles for insert
  with check (auth.uid() = id and status = 'pending');

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "delete own profile" on public.profiles;
create policy "delete own profile"
  on public.profiles for delete
  using (auth.uid() = id);

-- Nobody but an admin (service role / dashboard) may change status.
revoke update on public.profiles from anon, authenticated;
grant update (name, role, company, location, building, previously, open_to_work, skills,
              portfolio, linkedin, x, character, spot, updated_at)
  on public.profiles to authenticated;

create or replace function public.touch_profile() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_profile();
