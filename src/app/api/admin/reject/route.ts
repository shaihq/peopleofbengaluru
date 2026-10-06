import { getApplication, rejectAndRefund } from '@/lib/server/applications'
import { isAdmin, json, userFrom } from '@/lib/server/supabaseAdmin'

// REJECT + REFUND from the admin page, and RETRY REFUND for refund_failed (CLAUDE.md 5E-B).
// ACCEPT needs no server code: approve_application() checks is_admin() itself.

export async function POST(req: Request) {
  const user = await userFrom(req)
  if (!user) return json({ error: 'signed_out' }, 401)
  if (!(await isAdmin(user.id))) return json({ error: 'not_admin' }, 403)

  const { id, reason } = (await req.json().catch(() => ({}))) as { id?: string; reason?: string }
  if (!id) return json({ error: 'bad_request' }, 400)
  const app = await getApplication(id)
  if (!app) return json({ error: 'missing' }, 404)
  if (!['paid', 'under_review', 'refund_failed'].includes(app.status)) return json({ error: 'not_reviewable', status: app.status }, 409)

  const r = await rejectAndRefund(app, (reason ?? app.reason ?? '').trim(), user.id)
  return json(r, r.ok ? 200 : 502)
}
