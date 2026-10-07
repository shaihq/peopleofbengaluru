import 'server-only'

// Transactional email through Resend (CLAUDE.md Phase 5G). Without RESEND_API_KEY nothing is sent.
// Until a domain is verified in Resend, onboarding@resend.dev only delivers to the account owner.
const FROM = 'People of Bengaluru <onboarding@resend.dev>'

export async function sendEmail(to: string, subject: string, html: string, text: string) {
  const key = process.env.RESEND_API_KEY
  if (!key) return { skipped: true }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html, text }),
  })
  if (!res.ok) console.error('[email] resend', res.status, await res.text().catch(() => ''))
  return { ok: res.ok }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** One card in the game's colours: ink panel, saffron action, condensed caps. */
export function emailCard({ kicker, title, body, cta, href }: { kicker: string; title: string; body: string; cta: string; href: string }) {
  return `<!doctype html><html><body style="margin:0;padding:32px 16px;background:#1C1F2B;font-family:Barlow,Helvetica,Arial,sans-serif;color:#FFF6E5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#2A2F40;border-top:6px solid #FFB020">
<tr><td style="padding:28px 28px 8px;font-size:12px;font-weight:800;letter-spacing:.18em;color:#FFB020">${esc(kicker)}</td></tr>
<tr><td style="padding:0 28px;font-size:30px;line-height:1.1;font-weight:800;font-style:italic;text-transform:uppercase">${esc(title)}</td></tr>
<tr><td style="padding:14px 28px 24px;font-size:16px;line-height:1.5;color:rgba(255,246,229,.85)">${esc(body)}</td></tr>
<tr><td style="padding:0 28px 30px"><a href="${esc(href)}" style="display:inline-block;background:#FFB020;color:#1C1F2B;text-decoration:none;font-weight:800;font-style:italic;letter-spacing:.06em;padding:12px 22px">${esc(cta)} &#9656;</a></td></tr>
</table>
<p style="max-width:520px;margin:16px auto 0;font-size:12px;color:rgba(255,246,229,.45)">You can turn these emails off in the city: Connections &rarr; Email me.</p>
</td></tr></table></body></html>`
}
