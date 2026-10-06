import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

// Dodo Payments (CLAUDE.md 5E-B). Plain REST, no SDK.
// DODO_ENV=live switches to live mode; anything else is test mode. Each mode has its own
// API key, webhook secret, brand (BRAND below) and product (app_settings.dodo_product_id).

export const DODO_MODE: 'live' | 'test' = process.env.DODO_ENV === 'live' ? 'live' : 'test'
const BASE = DODO_MODE === 'live' ? 'https://live.dodopayments.com' : 'https://test.dodopayments.com'

/** Our Dodo brand, "People of Bangalore", per mode. Not a secret. */
const BRAND: Record<typeof DODO_MODE, string | null> = {
  test: 'brnd_0NpARKVua0YvuytnvrdEj',
  live: null, // add the live brand ID when live mode is set up
}

/**
 * The Dodo business is shared with other brands (Tapaway, BuiltBy…) and they all hit the
 * same webhooks. Events tagged with another brand are none of our business.
 */
export function otherBrand(brandId: unknown) {
  const ours = BRAND[DODO_MODE]
  const b = typeof brandId === 'string' ? brandId : ''
  return !!ours && b.startsWith('brnd_') && b !== ours
}

async function dodo<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const key = process.env.DODO_API_KEY
  if (!key) throw new Error('DODO_API_KEY not set')
  const res = await fetch(BASE + path, {
    method: init?.method ?? 'GET',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Dodo ${path} ${res.status}: ${text.slice(0, 300)}`)
  return (text ? JSON.parse(text) : {}) as T
}

export type DodoPayment = {
  payment_id: string
  status: string | null // succeeded | failed | cancelled | processing | requires_customer_action | …
  total_amount: number
  currency: string
  metadata: Record<string, string>
  customer?: { email?: string }
}

export type DodoRefund = { refund_id: string; payment_id: string; status: 'succeeded' | 'failed' | 'pending' | 'review' }

export function createCheckout(p: {
  productId: string
  email: string
  name: string
  returnUrl: string
  metadata: Record<string, string>
}) {
  return dodo<{ session_id: string; checkout_url: string }>('/checkouts', {
    method: 'POST',
    body: {
      product_cart: [{ product_id: p.productId, quantity: 1 }],
      customer: { email: p.email, name: p.name },
      return_url: p.returnUrl,
      metadata: p.metadata,
    },
  })
}

export const getPayment = (id: string) => dodo<DodoPayment>(`/payments/${encodeURIComponent(id)}`)

export function refundPayment(paymentId: string, reason: string, metadata: Record<string, string>) {
  return dodo<DodoRefund>('/refunds', { method: 'POST', body: { payment_id: paymentId, reason: reason.slice(0, 3000), metadata } })
}

// ---------------------------------------------------------------------------
// Webhooks: Standard Webhooks signing — HMAC-SHA256 over `${id}.${timestamp}.${body}`,
// key = base64 part of the `whsec_…` secret, header `webhook-signature: v1,<b64> …`.
// ---------------------------------------------------------------------------

const TOLERANCE_S = 5 * 60

export type DodoEvent = { type: string; timestamp: string; data: Record<string, unknown> & { payload_type?: string } }

export function verifyWebhook(body: string, headers: Headers): DodoEvent | null {
  const secret = process.env.DODO_WEBHOOK_SECRET
  if (!secret) throw new Error('DODO_WEBHOOK_SECRET not set')
  const id = headers.get('webhook-id')
  const ts = headers.get('webhook-timestamp')
  const sigs = headers.get('webhook-signature')
  if (!id || !ts || !sigs) return null
  if (Math.abs(Date.now() / 1000 - Number(ts)) > TOLERANCE_S) return null

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest()
  const ok = sigs.split(' ').some((s) => {
    const [v, b64] = s.split(',')
    if (v !== 'v1' || !b64) return false
    const got = Buffer.from(b64, 'base64')
    return got.length === expected.length && timingSafeEqual(got, expected)
  })
  return ok ? (JSON.parse(body) as DodoEvent) : null
}
