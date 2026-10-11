-- People of Bengaluru — scheduled jobs (pg_cron + pg_net). The database calls the website on a schedule,
-- with the same CRON_SECRET the website has.
--
-- Each database needs its two Vault secrets, set by hand (never in a migration, never committed):
--   production: select vault.create_secret('https://peopleofbengaluru.com', 'site_url');
--   staging:    select vault.create_secret('https://dev.peopleofbengaluru.com', 'site_url');
--   both:       select vault.create_secret('<CRON_SECRET>', 'cron_secret');
-- Without them the job runs and does nothing.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.call_cron(p_path text) returns bigint
language sql security definer set search_path = public as $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'site_url') || p_path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    timeout_milliseconds := 30000
  )
$$;
revoke execute on function public.call_cron(text) from anon, authenticated, public;

-- unread chat messages → one email (every 5 minutes)
select cron.schedule('chat-digest', '*/5 * * * *', $$ select public.call_cron('/api/cron/chat-digest') $$);

-- check:   select jobname, schedule, active from cron.job;
-- history: select * from cron.job_run_details order by start_time desc limit 20;
-- responses: select id, status_code, left(content::text, 200) from net._http_response order by created desc limit 20;
