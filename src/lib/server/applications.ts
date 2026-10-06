import 'server-only'
import { admin, type ApplicationRow } from './supabaseAdmin'
import { refundPayment, type DodoPayment } from './dodo'

// The application state machine on the server (CLAUDE.md 5E-B). Every transition is
// idempotent, so the webhook, the return-page confirm and a retry can all call it safely.
//
// submitted ──payment.succeeded──▶ under_review ──ACCEPT──▶ approved
//                                        └──REJECT / no decision──▶ rejected ──refund.succeeded──▶ refunded
//                                                                       └─ refund call fails ──▶ refund_failed (retry)

const db = () => admin().from('applications')

export async function getApplication(id: string) {
  const { data } = await db().select('*').eq('id', id).maybeSingle()
  return data as ApplicationRow | null
}

export async function openApplicationOf(userId: string) {
  const { data } = await db()
    .select('*')
    .eq('user_id', userId)
    .not('status', 'in', '(rejected,refunded)')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data as ApplicationRow | null
}

/**
 * A Dodo payment for an application. Succeeded + unpaid → under review.
 * A second payment for an application that is already paid or decided is refunded at once.
 */
export async function recordPayment(p: DodoPayment): Promise<ApplicationRow['status'] | null> {
  const appId = p.metadata?.application_id
  if (!appId) return null
  const app = await getApplication(appId)
  if (!app) return null
  if (p.status !== 'succeeded') return app.status

  if (app.status === 'draft' || app.status === 'submitted') {
    const { data } = await db()
      .update({
        status: 'under_review',
        payment_id: p.payment_id,
        amount: p.total_amount,
        currency: p.currency,
        paid_at: new Date().toISOString(),
      })
      .eq('id', app.id)
      .in('status', ['draft', 'submitted']) // lost a race with the other caller: fine
      .select('status')
      .maybeSingle()
    return (data?.status as ApplicationRow['status'] | undefined) ?? (await getApplication(app.id))?.status ?? null
  }

  if (app.payment_id && app.payment_id !== p.payment_id) {
    // paid twice (two tabs, a retry): keep the first, give the second back
    await refundPayment(p.payment_id, 'Duplicate application payment', { application_id: app.id }).catch((e) =>
      console.error('[apply] duplicate refund failed', p.payment_id, e),
    )
  }
  return app.status
}

/** REJECT (or no decision in time): refund through Dodo, then wait for refund.succeeded. */
export async function rejectAndRefund(app: ApplicationRow, reason: string, reviewer: string | null) {
  const base = { reason: reason.slice(0, 400) || null, reviewer, decided_at: new Date().toISOString() }
  if (!app.payment_id) {
    await db().update({ ...base, status: 'rejected' }).eq('id', app.id)
    return { ok: true as const, status: 'rejected' as const }
  }
  try {
    const r = await refundPayment(app.payment_id, reason || 'Application not approved', { application_id: app.id })
    const status = r.status === 'succeeded' ? 'refunded' : r.status === 'failed' ? 'refund_failed' : 'rejected'
    await db().update({ ...base, status, refund_id: r.refund_id }).eq('id', app.id)
    return { ok: status !== 'refund_failed', status }
  } catch (e) {
    console.error('[apply] refund failed', app.id, e)
    await db().update({ ...base, status: 'refund_failed' }).eq('id', app.id)
    return { ok: false as const, status: 'refund_failed' as const, error: String(e) }
  }
}

/** refund.succeeded / refund.failed from the webhook. */
export async function recordRefund(paymentId: string, refundId: string, succeeded: boolean) {
  await db()
    .update({ status: succeeded ? 'refunded' : 'refund_failed', refund_id: refundId })
    .eq('payment_id', paymentId)
    .in('status', ['rejected', 'refund_failed', 'under_review'])
}
