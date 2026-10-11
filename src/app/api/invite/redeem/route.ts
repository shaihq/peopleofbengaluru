import { after } from 'next/server'
import { asUser, bearer } from '@/lib/server/connect'
import { emailRedeemed } from '@/lib/server/invites'
import { json } from '@/lib/server/supabaseAdmin'
import { siteOrigin } from '@/lib/server/env'

// Invite path, last step → redeem_invite() as the caller (one transaction: code used, profile live,
// your own codes issued); then the welcome + "they joined" emails (CLAUDE.md Phase 5D).
export async function POST(req: Request) {
  const token = bearer(req)
  if (!token) return json({ ok: false, state: 'signed_out' }, 401)
  const body = (await req.json().catch(() => ({}))) as { code?: string; profile?: unknown }
  if (!body.code || !body.profile) return json({ ok: false, state: 'invalid' }, 400)

  const sb = asUser(token)
  const { data, error } = await sb.rpc('redeem_invite', { p_code: body.code, p_profile: body.profile })
  // PGRST30x: the token is bad or expired → the client asks them to open the email link again
  if (error?.code?.startsWith('PGRST30')) return json({ ok: false, state: 'signed_out' }, 401)
  if (error) return json({ ok: false, state: 'error', message: error.message, code: error.code }, 500)
  const r = data as { ok: boolean; state?: string }

  if (r.ok) {
    const { data: auth } = await sb.auth.getUser(token)
    const me = auth.user?.id
    const origin = siteOrigin(req)
    if (me) after(() => emailRedeemed(me, origin).catch((e) => console.error('[invite] email', e)))
  }
  return json(r)
}
