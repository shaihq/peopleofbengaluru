import { rejectAndRefund } from '@/lib/server/applications'
import { admin, json, setting, type ApplicationRow } from '@/lib/server/supabaseAdmin'

// "A reviewer never decides": refund applications paid more than N days ago
// (app_settings.review_auto_refund_days). Call daily with `Authorization: Bearer $CRON_SECRET`
// (Vercel Cron sends this header automatically when CRON_SECRET is set).

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return json({ error: 'unauthorized' }, 401)

  const days = Number(await setting('review_auto_refund_days', 14))
  const before = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data } = await admin()
    .from('applications')
    .select('*')
    .eq('status', 'under_review')
    .lt('paid_at', before)
    .limit(50)

  const done: { id: string; status: string }[] = []
  for (const app of (data ?? []) as ApplicationRow[]) {
    const r = await rejectAndRefund(app, `No decision within ${days} days — your fee is refunded in full.`, null)
    done.push({ id: app.id, status: r.status })
  }
  return json({ refunded: done.length, done })
}
