import { after } from 'next/server'
import { asUser, bearer, emailMatch, type ConnectResult } from '@/lib/server/connect'
import { json } from '@/lib/server/supabaseAdmin'
import { siteOrigin } from '@/lib/server/env'

// ACCEPT / NOT NOW → respond_connect() as the caller. Only a yes sends an email (CLAUDE.md 5G-A);
// a no is never told to anyone.
export async function POST(req: Request) {
  const token = bearer(req)
  if (!token) return json({ ok: false, state: 'signed_out' }, 401)
  const body = (await req.json().catch(() => ({}))) as { id?: string; accept?: boolean }
  if (!body.id || typeof body.accept !== 'boolean') return json({ ok: false, state: 'invalid' }, 400)

  const sb = asUser(token)
  const { data, error } = await sb.rpc('respond_connect', { p_id: body.id, p_accept: body.accept })
  if (error) return json({ ok: false, state: 'error' }, 500)
  const r = data as ConnectResult

  const { data: auth } = await sb.auth.getUser(token)
  const me = auth.user?.id
  const origin = siteOrigin(req)
  if (me && r.ok && r.state === 'matched' && r.other && r.intent) {
    const { other, intent } = r
    after(() => emailMatch(me, other, intent, origin).catch((e) => console.error('[connect] email', e)))
  }
  // the client only learns "done"; whether it was a yes it already knows
  return json(r.state === 'declined' ? { ok: true, state: 'declined', id: r.id } : r)
}
