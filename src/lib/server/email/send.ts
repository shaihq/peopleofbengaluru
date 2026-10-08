import 'server-only'
import { TEMPLATES, type TemplateName, type TemplateVariables } from './templates'

// Transactional email through Resend (CLAUDE.md: EMAILS). The server only picks a template and fills its
// variables; From, Subject and the copy are set on the template in Resend. Without RESEND_API_KEY nothing is sent.

// Resend inserts {{{VARIABLES}}} as-is, into the HTML body and the plain-text subject alike, and names come
// from members. Entities would show up literally in the subject (O&#39;Brien), so instead no value may
// carry a tag: < and > are dropped. Quotes and & are harmless in body text; the only attribute is LINK, ours.
const clean = (s: string) => s.replace(/[<>]/g, '')

/** Send a published Resend template. The variables are checked against TEMPLATES at compile time. */
export async function sendTemplate<T extends TemplateName>(to: string, template: T, variables: TemplateVariables<T>) {
  const key = process.env.RESEND_API_KEY
  if (!key) return { skipped: true }
  const { alias } = TEMPLATES[template]
  const values = Object.fromEntries(Object.entries<string>(variables).map(([k, v]) => [k, clean(v)]))
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, template: { id: alias, variables: values } }),
  })
  if (!res.ok) console.error('[email] resend', alias, res.status, await res.text().catch(() => ''))
  return { ok: res.ok }
}
