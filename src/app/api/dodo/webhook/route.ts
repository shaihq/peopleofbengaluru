import { otherBrand, verifyWebhook, type DodoPayment } from '@/lib/server/dodo'
import { recordPayment, recordRefund } from '@/lib/server/applications'
import { json } from '@/lib/server/supabaseAdmin'

// Dodo → us. The source of truth for payments and refunds (CLAUDE.md 5E-B).
// Point the Dodo dashboard webhook at https://<site>/api/dodo/webhook and put its
// signing secret in DODO_WEBHOOK_SECRET.

export async function POST(req: Request) {
  const body = await req.text()
  let event
  try {
    event = verifyWebhook(body, req.headers)
  } catch (e) {
    console.error('[dodo] webhook not configured', e)
    return json({ error: 'not_configured' }, 500)
  }
  if (!event) return json({ error: 'bad_signature' }, 401)

  const d = event.data
  // another brand on the same Dodo business: acknowledge and ignore
  if (otherBrand(d.brand_id)) return json({ ok: true, ignored: 'other_brand' })
  try {
    switch (event.type) {
      case 'payment.succeeded':
        // only our checkouts carry application_id; anything else isn't ours either
        if ((d as { metadata?: Record<string, string> }).metadata?.application_id) await recordPayment(d as unknown as DodoPayment)
        break
      case 'refund.succeeded':
      case 'refund.failed':
        await recordRefund(String(d.payment_id), String(d.refund_id), event.type === 'refund.succeeded')
        break
      // payment.failed / cancelled: the application stays unpaid and the player can retry
    }
  } catch (e) {
    console.error('[dodo] webhook handling failed', event.type, e)
    return json({ error: 'failed' }, 500) // Dodo retries
  }
  return json({ ok: true })
}
