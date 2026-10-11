-- People of Bengaluru — who may touch what through the API, written down.
-- Projects created before late 2026 (production) gave anon / authenticated / service_role broad access
-- to every new table by default; newer ones (the staging branch) give none. Row-level security still
-- decides which rows; these grants only say which tables and functions each role may reach at all.
-- On production this changes nothing (it already has these and more). Safe to re-run.

grant usage on schema public to anon, authenticated, service_role;

-- the server (service role key) does everything RLS doesn't let members do
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

-- read: everyone sees approved profiles and the settings; members see their own rows (RLS)
grant select on public.profiles, public.app_settings to anon, authenticated;
grant select on public.invites, public.applications, public.member_settings, public.reports to authenticated;

-- write: your own profile (insert pending, delete; update is per column in 0001 / 0005) and email setting
grant insert, delete on public.profiles to authenticated;
grant insert, update on public.member_settings to authenticated;

-- connections, messages, blocks and admins stay closed: only the security-definer functions touch them
