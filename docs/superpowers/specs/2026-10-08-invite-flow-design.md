# Invite flow — finishing Phase 5D

Date: 2026-10-08 · Status: approved in chat, awaiting spec review

## Goal

Members can actually invite people: see their 2 codes, turn one into a link, share it, and see who joined.
Someone opening an invite link is greeted by the invite. Both sides get an email when an invite is used.

## Decisions (from the brainstorm)

- Every member gets 2 codes, from day one, whether they came in by invite or by an approved application
  (`invites_per_member` setting, already built).
- A sent link that is unused after 30 days is dead; the slot comes back with a **fresh code**. The old link
  keeps answering "expired".
- "Removed" means only that: an expired code stops working. **No admin removal, no inviter penalty.**
  CLAUDE.md's inviter-accountability rule and email 9 (codes revoked) are dropped.
- **No rate limiting** of code checks in this round. Known risk: `check_invite` can be called repeatedly to
  guess codes (~887M space). Revisit if it matters.
- Email 8 (invite returned) is dropped: the slot visibly comes back the next time the member opens the screen.
- Out of scope: the Supabase magic-link email template (dashboard paste, separate to-do).

## 1. YOUR INVITES screen

`src/game/hud/Invites.tsx`, store flag `invitesOpen` in `src/game/store.ts` (same pattern as `connectOpen`:
opening releases the mouse and closes the profile panel / finder / status editor).

Opened by:
- **I** while playing (members only; ignored while typing or with another panel open),
- an **INVITES** button on your card (`YouCard.tsx`, beside SET STATUS / EDIT PROFILE),
- **YOUR INVITES** in the pause menu (`Pause.tsx`), members only,
- `?invites` in the URL (the welcome email links here), once the member is loaded.

Ghosts never see it (no button, I does nothing).

Layout (design.md §10): a slanted ink panel over the live street, like Connections. Header "YOUR INVITES",
line "Bring in people you'd vouch for. They go live instantly, no review." Then one chunky slanted card per slot:

| Slot state | Shows | Action |
|---|---|---|
| READY | "INVITE READY" | optional "Who's it for?" (≤ 40 chars, saved in `invites.note`), then **CREATE INVITE LINK** (saffron) |
| SENT | the link, "for Priya · 27 days left" (or "· sent 3 days ago" with no name) | **COPY LINK**; on touch, **SHARE** uses `navigator.share` when available, else copy |
| JOINED | "PRIYA JOINED · 12 OCT", their role, in UI_OPEN green | none |
| RENEWED (a ready slot whose previous link expired) | as READY, plus the line "Your link to Priya went unused, so here's a fresh one." | as READY |

- Copy confirms with the existing toast ("LINK COPIED").
- The link is `${origin}/?invite=CODE`.
- Keyboard: up/down moves between slots, Enter runs the slot's action, Esc closes. Touch: tap targets ≥ 44px,
  the panel is a full-width bottom sheet in portrait (Phase 6B rule).
- Empty / error: if loading fails, "Couldn't load your invites" with RETRY.
- `?gatepreview` (existing mock switch) also mocks this screen: one ready, one sent; creating a link fakes a sent slot.

Client data: `src/game/invites.ts` (zustand), `load()` → `my_invites()`, `create(code, note)` → `create_invite_link()`.

## 2. Database — `supabase/migrations/0007_invites.sql`

All `security definer`, `auth.uid()`-scoped, granted to `authenticated` only. Safe to re-run.

**`create_invite_link(p_code text, p_note text) → jsonb`**
- The code must be yours and `available`; otherwise `{ ok: false, state }`.
- Sets `state = 'sent'`, `sent_at = now()`, `note = nullif(trim(p_note), '')` (≤ 40 chars).
- Returns `{ ok: true, code, sent_at }`.

**`my_invites() → jsonb` (array of slots)**
1. Renewal first, in the same call: every one of your `sent` codes older than `invite_sent_expiry_days` is
   set to `state = 'expired'` (new state value) and, for each, a fresh code is issued to you with
   `renewed_from` = the old code's note (new nullable column `invites.renewed_from text`, so the card can say
   who the unused link was for).
2. Returns your non-expired, non-revoked codes, oldest first:
   `{ code, state, note, sent_at, expires_at, renewed_from, joined: { name, role, at } | null }`.
   `joined` comes from the profile of `used_by` (approved profiles only; otherwise name "A new member").

Schema changes:
- `invites.state` check gains `'expired'`.
- `invites.renewed_from text check (char_length(renewed_from) <= 40)`.
- `invite_state()` treats `state = 'expired'` as `'expired'` (the time-based rule stays, for codes nobody has
  renewed yet).

Unchanged: `check_invite`, `redeem_invite`, `issue_invites`, `approve_application` (already issues 2 codes).

## 3. Invite landing (`?invite=CODE`)

`Intro.tsx`. `access.ts` already reads `?invite=` into `linkCode`. On load, when `linkCode` is set and the
visitor is not a member, the intro runs `checkCode()` (existing; fills `inviter`).

- Code ok: the title block becomes kicker **"YOU'RE INVITED"**, title **"PRIYA INVITED YOU"** (first name),
  their role, and "Walk the city. When you're ready, you go live — no review." The button reads
  **ACCEPT INVITE ▸**: it enters the city and opens the gate on the code step with the ✓ already showing.
- Code not ok (or still checking when the city is ready): the normal title screen. The existing gate handles
  the error with "Pay instead" when they press V / USE YOUR INVITE.
- Members opening an invite link: normal title screen, invite ignored.

## 4. Emails

Redeeming moves behind a server route so it can email.

**`POST /api/invite/redeem`** (`src/app/api/invite/redeem/route.ts`), body `{ code, profile }`, bearer token:
- Runs `redeem_invite(code, profile)` as the caller (`asUser`, as in connect).
- On `ok`, after the response (`after()`), sends:
  - **inviteWelcome** → the new member. Variables: `NAME` (first name), `INVITER` (inviter's first name, or
    "The founders"), `INVITES` (number, from the setting), `LINK` = `${origin}/?invites`.
  - **inviteJoined** → the inviter (skipped for founder codes). Variables: `NAME` (inviter's first name),
    `INVITEE` (new member's name), `ROLE` (their role), `LINK` = `${origin}/`.
- Returns the RPC result unchanged. `onboarding.ts` `redeemInvite()` calls this route instead of the RPC;
  its error handling stays as it is.

Server helpers in `src/lib/server/invites.ts` (who-is-who lookups, like `connect.ts`). Both entries added to
`src/lib/server/email/templates.ts`. The templates are created by hand in Resend (aliases `invite-welcome`,
`invite-joined`), From and Subject set there. These are account emails: always sent, no opt-out footer.

Until the two templates exist in Resend, the sends fail and are logged; redeeming still works.

## 5. CLAUDE.md updates

- 5D: Your invites and invite landing built; drop inviter accountability / removal handling and the rate-limit
  to-do (note the known risk); slot renewal with a fresh code.
- EMAILS: emails 6 and 7 → built with their aliases; remove 8 and 9.

## Testing

- SQL: run the migration on the project; in the SQL editor, as a test member: create a link, back-date
  `sent_at` 31 days, call `my_invites()` → old code `expired`, fresh code with `renewed_from`; `check_invite`
  on the old code → `expired`.
- `?gatepreview`: walk every slot state on desktop and a phone-sized viewport, keyboard only and touch.
- End to end on dev: member creates a link → open it in a private window → landing shows the inviter →
  accept → finish profile → magic link → live; the inviter's screen shows JOINED; both emails arrive
  (to the Resend owner address until the domain is verified).
- `npx tsc --noEmit` clean.
