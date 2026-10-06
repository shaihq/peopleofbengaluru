import { getPayment, otherBrand } from '@/lib/server/dodo'
import { recordPayment } from '@/lib/server/applications'
import { json, userFrom } from '@/lib/server/supabaseAdmin'

// Back from the Dodo checkout with ?payment_id=…: ask Dodo what really happened.
// Same transition as the webhook, so whichever arrives first wins and the other is a no-op.
// (Also what makes payments work locally, where Dodo can't reach the webhook.)

export async function POST(req: Request) {
  const user = await userFrom(req)
  if (!user) return json({ error: 'signed_out' }, 401)

  const { payment_id } = (await req.json().catch(() => ({}))) as { payment_id?: string }
  if (!payment_id || !/^[A-Za-z0-9_]+$/.test(payment_id)) return json({ error: 'bad_request' }, 400)

  try {
    const p = await getPayment(payment_id)
    if (p.metadata?.user_id !== user.id || otherBrand((p as { brand_id?: string }).brand_id)) return json({ error: 'not_yours' }, 403)
    const status = await recordPayment(p)
    return json({ payment: p.status, status })
  } catch (e) {
    console.error('[apply] confirm failed', e)
    return json({ error: 'lookup_failed' }, 502)
  }
}
