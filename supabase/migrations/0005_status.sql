-- Designers of Bengaluru — STATUS (CLAUDE.md Phase 5F-B)
-- A short line + an emoji above your head: who's open to being approached, and
-- something to say. Called "note" here because profiles.status is already approval.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table public.profiles add column if not exists note_text text;
alter table public.profiles add column if not exists note_emoji text;
-- null = don't clear
alter table public.profiles add column if not exists note_expires_at timestamptz;

alter table public.profiles drop constraint if exists profiles_note_text_check;
alter table public.profiles add constraint profiles_note_text_check
  check (note_text is null or char_length(note_text) between 1 and 100);

-- one emoji; some emoji are several code points (skin tones, flags, ZWJ sequences)
alter table public.profiles drop constraint if exists profiles_note_emoji_check;
alter table public.profiles add constraint profiles_note_emoji_check
  check (note_emoji is null or char_length(note_emoji) between 1 and 16);

-- Members change their own status at any time, without re-approval. The existing
-- "update own profile" policy keeps it to your own row; this only opens the columns.
grant update (note_text, note_emoji, note_expires_at) on public.profiles to authenticated;

-- Moderation: an admin can clear anyone's status (from the SQL editor, or later the admin page).
create or replace function public.admin_clear_status(p_user uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;
  update public.profiles set note_text = null, note_emoji = null, note_expires_at = null where id = p_user;
end $$;

revoke execute on function public.admin_clear_status(uuid) from public, anon;
grant execute on function public.admin_clear_status(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin cheatsheet (SQL editor)
-- ---------------------------------------------------------------------------
-- Everyone's current status:  select name, note_emoji, note_text, note_expires_at from public.profiles
--                             where note_text is not null or note_emoji is not null;
-- Clear someone's status:     update public.profiles set note_text = null, note_emoji = null,
--                             note_expires_at = null where name = 'THEIR NAME';
