-- People of Bengaluru — CHAT, PHASE B (CLAUDE.md Phase 5G). Run ONLY after production (main) runs the
-- chat code: the old site still reads contacts and calls the old connect functions.
-- Deletes every saved contact (WhatsApp numbers, handles): chat replaced the handoff, so we stop holding them.
--
-- Safe to re-run.

drop function if exists public.send_connect(uuid, text, text);
drop function if exists public.send_connect(uuid, text);
drop function if exists public.respond_connect(uuid, boolean);
drop function if exists public.my_connections();

drop table if exists public.contacts;
drop function if exists public.valid_contact(text, text);
