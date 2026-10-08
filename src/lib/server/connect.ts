import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { intentOf } from '@/lib/intents'
import { admin } from './supabaseAdmin'
import { sendTemplate } from './email/send'

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
  await sendTemplate(w.email, 'connectRequest', { EMOJI: i.emoji, SENDER: w.name, SENDER_FIRST: firstName(w.name), VERB: i.verb, LINK: `${origin}/?connections` })
}

/** "It's a match" → the person who asked first. */
export async function emailMatch(accepterId: string, askerId: string, intent: string, origin: string) {
  const w = await who(accepterId, askerId)
  if (!w) return
  const i = intentOf(intent)
  await sendTemplate(w.email, 'connectMatch', { EMOJI: i.emoji, SENDER: w.name, VERB: i.verb, LINK: `${origin}/?connections` })
}
