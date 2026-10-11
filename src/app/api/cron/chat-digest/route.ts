import { emailMessage } from '@/lib/server/connect'
import { admin, json } from '@/lib/server/supabaseAdmin'
import { siteOrigin } from '@/lib/server/env'

// Unread chat messages → one email (CLAUDE.md 5G). Someone with messages unread for 10+ minutes gets
// "Ananya sent you a message", at most once per chat every 6 hours, never with the message text, and
// never if they turned emails off (chat_digest_due() in 20261011080848_chat_phase_a.sql decides who).
// Called every 5 minutes by pg_cron in Supabase with `Authorization: Bearer $CRON_SECRET`.

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return json({ error: 'unauthorized' }, 401)

  const db = admin()
  const { data, error } = await db.rpc('chat_digest_due', {
    p_min_age: '10 minutes',
    p_gap: '6 hours',
  })
  if (error) return json({ error: 'query failed' }, 500)
  const due = (data ?? []) as {
    connection_id: string
    recipient_id: string
    sender_name: string
    unread: number
  }[]

  const origin = siteOrigin(req)
  let sent = 0
  for (const d of due) {
    const ok = await emailMessage(d.recipient_id, d.sender_name, d.unread, origin).catch((e) => {
      console.error('[chat] email', e)
      return false
    })
    if (!ok) continue
    sent++
    await db.rpc('chat_mark_emailed', {
      p_conn: d.connection_id,
      p_recipient: d.recipient_id,
    })
  }
  return json({ due: due.length, sent })
}
