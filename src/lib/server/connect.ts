import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { intentOf } from '@/lib/intents'
import { admin } from './supabaseAdmin'
import { emailCard, sendEmail } from './email'

// CONNECT (CLAUDE.md Phase 5G): the actions run as the caller (their token, so auth.uid() and the
// rules in 0006_connections.sql apply); the emails go out from the server afterwards.
// Emails never carry contact details — the reveal happens in the city.

export function bearer(req: Request) {
  return req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null
}

/** Supabase as the signed-in caller. */
export function asUser(token: string) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY not set')
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export type ConnectResult = { ok: boolean; state: string; id?: string; intent?: string; other?: string }

const firstName = (name: string) => name.trim().split(/\s+/)[0]

/** Name of `from` + email address of `to`, unless `to` turned emails off. */
async function who(fromId: string, toId: string) {
  const db = admin()
  const [{ data: from }, { data: pref }, { data: user }] = await Promise.all([
    db.from('profiles').select('name').eq('id', fromId).maybeSingle(),
    db.from('contacts').select('emails').eq('user_id', toId).maybeSingle(),
    db.auth.admin.getUserById(toId),
  ])
  if (pref && pref.emails === false) return null
  const email = user?.user?.email
  return email && from ? { name: from.name as string, email } : null
}

/** "Ananya wants to grab coffee with you" → the person being asked. */
export async function emailRequest(fromId: string, toId: string, intent: string, origin: string) {
  const w = await who(fromId, toId)
  if (!w) return
  const i = intentOf(intent)
  const subject = `${i.emoji} ${w.name} wants to ${i.verb} with you`
  const body = `${w.name} found you in the city and wants to ${i.verb}. Say yes and you'll both see how to reach each other. Not feeling it? Do nothing — they're never told.`
  const href = `${origin}/?connections`
  await sendEmail(w.email, subject, emailCard({ kicker: 'PEOPLE OF BENGALURU · CONNECT', title: `${firstName(w.name)} wants to ${i.verb}`, body, cta: 'SEE THE REQUEST', href }), `${body}\n\n${href}`)
}

/** "It's a match" → the person who asked first. */
export async function emailMatch(accepterId: string, askerId: string, intent: string, origin: string) {
  const w = await who(accepterId, askerId)
  if (!w) return
  const i = intentOf(intent)
  const subject = `${i.emoji} It's a match — you and ${w.name} both want to ${i.verb}`
  const body = `${w.name} said yes. Both of you want to ${i.verb}. Open the city to see how to reach them, and take it from here.`
  const href = `${origin}/?connections`
  await sendEmail(w.email, subject, emailCard({ kicker: "PEOPLE OF BENGALURU · IT'S A MATCH", title: `Both of you want to ${i.verb}`, body, cta: 'TAKE IT FROM HERE', href }), `${body}\n\n${href}`)
}
