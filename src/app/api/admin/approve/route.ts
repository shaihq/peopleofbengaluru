import { after } from 'next/server'
import { asUser, bearer } from '@/lib/server/connect'
import { emailDecision, getApplication } from '@/lib/server/applications'
import { siteOrigin } from '@/lib/server/env'
import { json } from '@/lib/server/supabaseAdmin'

// ACCEPT from the admin page (CLAUDE.md 5E-B): approve_application() as the reviewer (it checks
// is_admin() itself: the profile goes live, invite codes are issued), then the "you're in" email.
export async function POST(req: Request) {
  const token = bearer(req)
  if (!token) return json({ ok: false, state: 'signed_out' }, 401)
  const { id } = (await req.json().catch(() => ({}))) as { id?: string }
  if (!id) return json({ ok: false, state: 'bad_request' }, 400)

  const { data, error } = await asUser(token).rpc('approve_application', { p_id: id, p_note: null })
  if (error) return json({ ok: false, state: 'error', message: error.message }, 500)
  const r = data as { ok: boolean; state?: string }
  if (!r.ok) return json(r, r.state === 'not_admin' ? 403 : 409)

  const app = await getApplication(id)
  if (app) {
    const origin = siteOrigin(req)
    after(() => emailDecision(app, true, origin).catch((e) => console.error('[admin] approve email', e)))
  }
  return json(r)
}
