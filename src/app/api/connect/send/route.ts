import { after } from 'next/server'
import { asUser, bearer, emailMatch, emailRequest, type ConnectResult } from '@/lib/server/connect'
import { json } from '@/lib/server/supabaseAdmin'

// CONNECT → send_connect() as the caller; then email the other person (CLAUDE.md 5G-A).
export async function POST(req: Request) {
  const token = bearer(req)
  if (!token) return json({ ok: false, state: 'signed_out' }, 401)
  const body = (await req.json().catch(() => ({}))) as { to?: string; intent?: string }
  if (!body.to || !body.intent) return json({ ok: false, state: 'invalid' }, 400)

  const sb = asUser(token)
  const { data, error } = await sb.rpc('send_connect', { p_to: body.to, p_intent: body.intent })
  if (error) return json({ ok: false, state: 'error' }, 500)
  const r = data as ConnectResult

  const { data: auth } = await sb.auth.getUser(token)
  const me = auth.user?.id
  const origin = req.headers.get('origin') ?? new URL(req.url).origin
  if (me && r.ok && r.other && r.intent) {
    const { other, intent, state } = r
    after(() =>
      (state === 'sent' ? emailRequest(me, other, intent, origin) : emailMatch(me, other, intent, origin)).catch((e) =>
        console.error('[connect] email', e),
      ),
    )
  }
  return json(r)
}
