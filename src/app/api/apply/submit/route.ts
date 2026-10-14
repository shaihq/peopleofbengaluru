import { after } from 'next/server'
import { APPLICATIONS_FREE } from '@/lib/apply'
import { sendTemplate } from '@/lib/server/email/send'
import { siteOrigin } from '@/lib/server/env'
import { admin, json } from '@/lib/server/supabaseAdmin'

// Apply to join, while it's free (src/lib/apply.ts): no email confirmation first. The account for that
// email is found or created here (unconfirmed; the magic link confirms it when they sign in once approved),
// and the application goes straight to the review queue. Then "application received" (CLAUDE.md: EMAILS #8).

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Body = { email?: string; answers?: { why?: string; whatsapp?: string }; profile?: Record<string, unknown> }

export async function POST(req: Request) {
  if (!APPLICATIONS_FREE) return json({ ok: false, state: 'signin_required' }, 403)
  const raw = await req.text()
  if (raw.length > 8000) return json({ ok: false, state: 'invalid' }, 413)
  let body: Body
  try {
    body = JSON.parse(raw) as Body
  } catch {
    return json({ ok: false, state: 'invalid' }, 400)
  }
  const email = String(body.email ?? '').trim().toLowerCase()
  if (!EMAIL.test(email) || email.length > 254 || !body.profile || typeof body.answers?.why !== 'string') {
    return json({ ok: false, state: 'invalid' }, 400)
  }

  const db = admin()
  const submit = () =>
    db.rpc('submit_application_for', { p_email: email, p_answers: body.answers, p_profile: body.profile })

  let { data, error } = await submit()
  if (!error && (data as { state?: string })?.state === 'no_user') {
    // new here: make the account (unconfirmed). A race with a second request is fine: the retry finds it.
    const made = await db.auth.admin.createUser({ email, email_confirm: false })
    if (made.error && made.error.code !== 'email_exists') {
      console.error('[apply] create user', made.error)
      return json({ ok: false, state: 'error' }, 500)
    }
    ;({ data, error } = await submit())
  }
  if (error) {
    console.error('[apply] submit', error)
    return json({ ok: false, state: 'error' }, 500)
  }

  const r = data as { ok: boolean; state?: string }
  if (r.ok) {
    const name = String(body.profile.name ?? '').trim().split(/\s+/)[0] || 'there'
    const origin = siteOrigin(req)
    after(() =>
      sendTemplate(email, 'applicationReceived', { NAME: name, LINK: origin }).catch((e) =>
        console.error('[apply] email', e),
      ),
    )
  }
  return json(r, r.ok ? 200 : 409)
}
