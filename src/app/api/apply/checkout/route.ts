import { createCheckout, DODO_MODE } from '@/lib/server/dodo'
import { openApplicationOf } from '@/lib/server/applications'
import { admin, json, setting, userFrom } from '@/lib/server/supabaseAdmin'

// Pay path: the saved application → a Dodo checkout for the application fee (CLAUDE.md 5E-B).
// The client only gets a URL to go to; whether it was paid is decided by Dodo, not by us.

export async function POST(req: Request) {
  const user = await userFrom(req)
  if (!user?.email) return json({ error: 'signed_out' }, 401)

  const app = await openApplicationOf(user.id)
  if (!app) return json({ error: 'no_application' }, 404)
  if (app.status !== 'draft' && app.status !== 'submitted') return json({ error: 'already_paid', status: app.status }, 409)

  // one product per mode: { "test": "pdt_…", "live": "pdt_…" }
  const products = await setting<Record<string, string | null>>('dodo_product_id', {})
  const productId = products[DODO_MODE]
  if (!productId) return json({ error: 'not_configured' }, 500)

  const origin = req.headers.get('origin') ?? new URL(req.url).origin
  try {
    const s = await createCheckout({
      productId,
      email: user.email,
      name: String(app.profile.name ?? ''),
      // Dodo appends ?payment_id=…&status=… — the game confirms it server-side on return
      returnUrl: `${origin}/?paid=1`,
      metadata: { application_id: app.id, user_id: user.id },
    })
    await admin().from('applications').update({ checkout_id: s.session_id }).eq('id', app.id)
    return json({ url: s.checkout_url })
  } catch (e) {
    console.error('[apply] checkout failed', e)
    return json({ error: 'checkout_failed' }, 502)
  }
}
