import 'server-only'
import { admin } from './supabaseAdmin'
import { sendTemplate } from './email/send'

// YOUR INVITES (CLAUDE.md Phase 5D): the emails that follow a redeemed invite.
// Account emails, always sent. Founder codes (no owner) only send the welcome.

const firstName = (name: string) => name.trim().split(/\s+/)[0]

async function person(id: string) {
  const db = admin()
  const [{ data: profile }, { data: user }] = await Promise.all([
    db.from('profiles').select('name, role, invited_by').eq('id', id).maybeSingle(),
    db.auth.admin.getUserById(id),
  ])
  return profile ? { name: profile.name as string, role: (profile.role as string) ?? '', invitedBy: profile.invited_by as string | null, email: user?.user?.email ?? null } : null
}

/** Welcome → the new member; "they joined" → whoever vouched. */
export async function emailRedeemed(memberId: string, origin: string) {
  const db = admin()
  const member = await person(memberId)
  if (!member) return
  const inviter = member.invitedBy ? await person(member.invitedBy) : null
  const { data: setting } = await db.from('app_settings').select('value').eq('key', 'invites_per_member').maybeSingle()
  const invites = String(setting?.value ?? 2)

  await Promise.all([
    member.email &&
      sendTemplate(member.email, 'inviteWelcome', {
        NAME: firstName(member.name),
        INVITER: inviter ? firstName(inviter.name) : 'The founders',
        INVITES: invites,
        LINK: `${origin}/?invites`,
      }),
    inviter?.email &&
      sendTemplate(inviter.email, 'inviteJoined', {
        NAME: firstName(inviter.name),
        INVITEE: member.name,
        ROLE: member.role,
        LINK: `${origin}/`,
      }),
  ])
}
