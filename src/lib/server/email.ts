import 'server-only'

// Transactional email through Resend (CLAUDE.md: EMAILS). The copy and design live in Resend as
// templates; the server only picks one and fills its variables.
// Without RESEND_API_KEY nothing is sent.
// Until a domain is verified in Resend, onboarding@resend.dev only delivers to the account owner.
const FROM = 'People of Bengaluru <onboarding@resend.dev>'

// {{{TRIPLE}}} placeholders insert values as-is, and names come from members, so values are escaped here.
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** Send a published Resend template by alias. Every variable the template uses must be passed. */
export async function sendTemplate(to: string, alias: string, subject: string, variables: Record<string, string>) {
  const key = process.env.RESEND_API_KEY
  if (!key) return { skipped: true }
  const escaped = Object.fromEntries(Object.entries(variables).map(([k, v]) => [k, esc(v)]))
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, template: { id: alias, variables: escaped } }),
  })
  if (!res.ok) console.error('[email] resend', alias, res.status, await res.text().catch(() => ''))
  return { ok: res.ok }
}
