'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import './admin.css'
import { InvitesAdmin } from './InvitesAdmin'
import { gameOrigin } from '@/lib/site'
import { placeLabel } from '@/game/districts/registry'

// THE REVIEW QUEUE (CLAUDE.md 5E-B). Admins only (public.admins).
// ACCEPT → /api/admin/approve: approve_application() (profile goes live, invite codes issued) + the email.
// REJECT + REFUND → /api/admin/reject (Dodo refund from the server).
// REPORTS (5G): what a member reported from a chat → RESOLVE, or HIDE MEMBER (they leave the city).
// INVITES (5D): founder codes — make them in batches, track who joined with each, revoke (InvitesAdmin.tsx).

type App = {
  id: string
  user_id: string
  email: string
  why: string
  /** optional, +<country><number> (supabase/migrations/20261013160000_application_whatsapp.sql) */
  whatsapp?: string | null
  profile: {
    name?: string
    role?: string
    company?: string | null
    location?: string
    building?: string | null
    previously?: string | null
    skills?: string[]
    portfolio?: string | null
    linkedin?: string | null
    x?: string | null
    open_to_work?: boolean
  }
  status: 'draft' | 'submitted' | 'paid' | 'under_review' | 'approved' | 'rejected' | 'refunded' | 'refund_failed'
  payment_id: string | null
  amount: number | null
  currency: string | null
  reason: string | null
  paid_at: string | null
  decided_at: string | null
  created_at: string
}

const TABS = [
  { id: 'queue', label: 'TO REVIEW', statuses: ['paid', 'under_review'] },
  { id: 'problems', label: 'REFUND FAILED', statuses: ['refund_failed'] },
  { id: 'unpaid', label: 'NOT PAID YET', statuses: ['draft', 'submitted'] },
  { id: 'decided', label: 'DECIDED', statuses: ['approved', 'rejected', 'refunded'] },
] as const
type Tab = (typeof TABS)[number]['id'] | 'reports' | 'invites'

type Report = {
  id: string
  reporter_id: string | null
  reported_id: string | null
  reason: string | null
  status: 'open' | 'resolved' | 'hidden'
  created_at: string
  snapshot: {
    connection: { from_id: string; to_id: string; intent: string; note: string | null; status: string; created_at: string }
    reported: { id: string; name: string; role: string } | null
    messages: { from: string; body: string; at: string }[]
  }
}

const STATUS_LABEL: Record<App['status'], string> = {
  draft: 'DRAFT',
  submitted: 'NOT PAID',
  paid: 'PAID',
  under_review: 'TO REVIEW',
  approved: 'APPROVED',
  rejected: 'REJECTED · REFUND PENDING',
  refunded: 'REJECTED · REFUNDED',
  refund_failed: 'REFUND FAILED',
}

const ago = (iso: string | null) => {
  if (!iso) return '—'
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`
  if (h < 48) return `${Math.round(h)}h ago`
  return `${Math.round(h / 24)}d ago`
}
const money = (a: App) =>
  a.amount == null ? '—' : `${a.currency === 'INR' ? '₹' : `${a.currency} `}${(a.amount / 100).toLocaleString('en-IN')}`
/** Applicant-supplied links: only http(s) ever becomes an href (no javascript: etc.). */
const safeUrl = (u?: string | null) => {
  try {
    const x = new URL(u ?? '')
    return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : null
  } catch {
    return null
  }
}

async function token() {
  const { data } = await supabase!.auth.getSession()
  return data.session?.access_token ?? null
}

export default function AdminClient() {
  const [phase, setPhase] = useState<'loading' | 'signed_out' | 'not_admin' | 'ready'>('loading')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  // each new link cancels the last, so a second click while sending breaks the first email
  const [sending, setSending] = useState(false)
  const [apps, setApps] = useState<App[]>([])
  const [members, setMembers] = useState<Set<string>>(new Set())
  const [reports, setReports] = useState<Report[]>([])
  const [tab, setTab] = useState<Tab>('queue')
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase.from('applications').select('*').order('created_at', { ascending: true })
    if (error) return setErr(error.message)
    const list = (data ?? []) as App[]
    setApps(list)
    const { data: rep } = await supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(200)
    setReports((rep ?? []) as Report[])
    // approved profiles are public: tells us who got in by invite while waiting
    const ids = list.map((a) => a.user_id)
    if (ids.length) {
      const { data: p } = await supabase.from('profiles').select('id').eq('status', 'approved').in('id', ids)
      setMembers(new Set((p ?? []).map((r: { id: string }) => r.id)))
    }
  }, [])

  useEffect(() => {
    if (!supabase) return setPhase('signed_out')
    const check = async () => {
      const { data } = await supabase!.auth.getSession()
      if (!data.session) return setPhase('signed_out')
      const { data: ok } = await supabase!.rpc('is_admin')
      if (!ok) return setPhase('not_admin')
      setPhase('ready')
      void load()
    }
    void check()
    const { data } = supabase.auth.onAuthStateChange((e) => {
      if (e === 'SIGNED_IN' || e === 'SIGNED_OUT') void check()
    })
    return () => data.subscription.unsubscribe()
  }, [load])

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.id, apps.filter((a) => (t.statuses as readonly string[]).includes(a.status)).length])),
    [apps],
  )
  const shown = useMemo(() => {
    const t = TABS.find((x) => x.id === tab)
    if (!t) return []
    const list = apps.filter((a) => (t.statuses as readonly string[]).includes(a.status))
    return tab === 'decided' ? list.reverse() : list
  }, [apps, tab])

  const sendLink = async () => {
    if (!supabase || sending) return
    setSending(true)
    setErr(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      // back to this page: / on the admin subdomains, /admin on previews and local
      options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}`, shouldCreateUser: false },
    })
    setSending(false)
    if (error) setErr(error.message)
    else setSent(true)
  }

  return (
    <div className="adm">
      <header className="adm-top">
        <div className="adm-badge slant">
          <span className="unslant">
            <small>PEOPLE OF BENGALURU</small>
            <b>REVIEW QUEUE</b>
          </span>
        </div>
        {phase === 'ready' && (
          <div className="adm-actions">
            <button className="adm-ghost" onClick={() => void load()}>
              REFRESH
            </button>
            <a className="adm-ghost" href={gameOrigin()}>
              BACK TO THE CITY ▸
            </a>
          </div>
        )}
      </header>

      {err && (
        <div className="adm-err" onClick={() => setErr(null)}>
          {err}
        </div>
      )}

      {phase === 'loading' && <p className="adm-empty">LOADING…</p>}

      {phase === 'signed_out' && (
        <div className="adm-panel adm-gate">
          <h1>REVIEWERS ONLY</h1>
          {sent ? (
            <p>Link sent. Open the newest email from us — the sign-in link brings you back here.</p>
          ) : (
            <>
              <p>Sign in with the email you added to the admins table.</p>
              <div className="adm-row">
                <input
                  type="email"
                  value={email}
                  placeholder="you@studio.com"
                  disabled={sending}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendLink()}
                />
                <button className="btn-primary slant adm-btn" onClick={sendLink} disabled={sending}>
                  <span className="unslant">{sending ? 'SENDING…' : 'SEND LINK ▸'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {phase === 'not_admin' && (
        <div className="adm-panel adm-gate">
          <h1>NOT A REVIEWER</h1>
          <p>
            This account isn’t in <code>public.admins</code>. Add it in the Supabase SQL editor, then refresh.
          </p>
          <button className="adm-ghost" onClick={() => supabase?.auth.signOut()}>
            SIGN OUT
          </button>
        </div>
      )}

      {phase === 'ready' && (
        <>
          <nav className="adm-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`adm-tab slant${tab === t.id ? ' adm-tab--on' : ''}${t.id === 'problems' && counts[t.id] ? ' adm-tab--alert' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <span className="unslant">
                  {t.label} <em>{counts[t.id]}</em>
                </span>
              </button>
            ))}
            <button
              className={`adm-tab slant${tab === 'reports' ? ' adm-tab--on' : ''}${reports.some((r) => r.status === 'open') ? ' adm-tab--alert' : ''}`}
              onClick={() => setTab('reports')}
            >
              <span className="unslant">
                REPORTS <em>{reports.filter((r) => r.status === 'open').length}</em>
              </span>
            </button>
            <button className={`adm-tab slant${tab === 'invites' ? ' adm-tab--on' : ''}`} onClick={() => setTab('invites')}>
              <span className="unslant">INVITES</span>
            </button>
          </nav>

          {tab === 'invites' ? (
            <InvitesAdmin onError={setErr} />
          ) : tab === 'reports' ? (
            <div className="adm-list">
              {reports.length === 0 && <p className="adm-empty">NO REPORTS</p>}
              {reports.map((r) => (
                <ReportCard key={r.id} r={r} onDone={load} onError={setErr} />
              ))}
            </div>
          ) : (
            <>
              {shown.length === 0 && (
                <p className="adm-empty">{tab === 'queue' ? 'NOBODY WAITING · THE QUEUE IS CLEAR' : 'NOTHING HERE'}</p>
              )}

              <div className="adm-list">
                {shown.map((a) => (
                  <Card key={a.id} a={a} member={members.has(a.user_id)} onDone={load} onError={setErr} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function Card({ a, member, onDone, onError }: { a: App; member: boolean; onDone: () => void; onError: (e: string) => void }) {
  const [mode, setMode] = useState<'idle' | 'rejecting'>('idle')
  const [reason, setReason] = useState(a.reason ?? '')
  const [busy, setBusy] = useState(false)
  const p = a.profile
  const links = { portfolio: safeUrl(p.portfolio), linkedin: safeUrl(p.linkedin), x: safeUrl(p.x) }
  const reviewable = a.status === 'paid' || a.status === 'under_review'

  const accept = async () => {
    setBusy(true)
    const t = await token()
    const res = await fetch('/api/admin/approve', {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: a.id }),
    })
    setBusy(false)
    const r = (await res.json().catch(() => ({}))) as { ok?: boolean; state?: string; error?: string }
    if (!r.ok) return onError(`Couldn’t approve (${r.state ?? r.error ?? res.status}).`)
    onDone()
  }

  // free applications (src/lib/apply.ts) have nothing to refund
  const paid = !!a.payment_id

  const reject = async () => {
    setBusy(true)
    const t = await token()
    const res = await fetch('/api/admin/reject', {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: a.id, reason }),
    })
    setBusy(false)
    const r = (await res.json().catch(() => ({}))) as { ok?: boolean; status?: string; error?: string }
    if (!r.ok) onError(r.status === 'refund_failed' ? 'Rejected, but the refund failed — retry it from REFUND FAILED.' : `Couldn’t reject (${r.error ?? res.status}).`)
    setMode('idle')
    onDone()
  }

  return (
    <article className={`adm-card adm-card--${a.status}`}>
      <div className="adm-who">
        <div className="adm-status">
          <span className={`adm-chip adm-chip--${a.status}`}>{a.status === 'rejected' && !paid ? 'REJECTED' : STATUS_LABEL[a.status]}</span>
          {member && <span className="adm-chip adm-chip--invite">JOINED BY INVITE</span>}
        </div>
        <h2>{(p.name ?? 'Unnamed').toUpperCase()}</h2>
        <p className="adm-role">
          {p.role}
          {p.company ? ` · ${p.company}` : ''}
        </p>
        <dl className="adm-facts">
          <dt>FROM</dt>
          <dd>{p.location ? placeLabel(p.location) : '—'}</dd>
          {p.building && (
            <>
              <dt>BUILDING</dt>
              <dd>{p.building}</dd>
            </>
          )}
          {p.previously && (
            <>
              <dt>PREVIOUSLY</dt>
              <dd>{p.previously}</dd>
            </>
          )}
          {!!p.skills?.length && (
            <>
              <dt>SKILLS</dt>
              <dd>{p.skills.join(', ')}</dd>
            </>
          )}
          <dt>EMAIL</dt>
          <dd>{a.email}</dd>
          {a.whatsapp && (
            <>
              <dt>WHATSAPP</dt>
              <dd>
                <a className="adm-wa" href={`https://wa.me/${a.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                  {a.whatsapp} ↗
                </a>
              </dd>
            </>
          )}
          <dt>PAID</dt>
          <dd>{paid ? `${money(a)} · ${ago(a.paid_at)}` : 'FREE APPLICATION'}</dd>
          <dt>APPLIED</dt>
          <dd>{ago(a.created_at)}</dd>
        </dl>
        <div className="adm-links">
          {links.portfolio && (
            <a href={links.portfolio} target="_blank" rel="noreferrer">
              PORTFOLIO
            </a>
          )}
          {links.linkedin && (
            <a href={links.linkedin} target="_blank" rel="noreferrer">
              LINKEDIN
            </a>
          )}
          {links.x && (
            <a href={links.x} target="_blank" rel="noreferrer">
              X
            </a>
          )}
        </div>
      </div>

      <div className="adm-answers">
        <Q k="WHY HERE?" v={a.why} />
        {a.reason && !reviewable && (
          <div className="adm-q">
            <span className="adm-k">NOTE</span>
            <p>{a.reason}</p>
          </div>
        )}

        {(reviewable || a.status === 'refund_failed') && (
          <div className="adm-decide">
            {mode === 'rejecting' ? (
              <>
                <textarea
                  value={reason}
                  maxLength={400}
                  rows={2}
                  autoFocus
                  placeholder="A short, kind reason — the applicant sees this."
                  onChange={(e) => setReason(e.target.value)}
                />
                <div className="adm-row">
                  <button className="adm-ghost" onClick={() => setMode('idle')} disabled={busy}>
                    CANCEL
                  </button>
                  <button className="adm-btn adm-btn--reject slant" onClick={reject} disabled={busy}>
                    <span className="unslant">{busy ? (paid ? 'REFUNDING…' : 'REJECTING…') : paid ? `REJECT + REFUND ${money(a)} ▸` : 'REJECT ▸'}</span>
                  </button>
                </div>
              </>
            ) : a.status === 'refund_failed' ? (
              <button className="adm-btn adm-btn--reject slant" onClick={reject} disabled={busy}>
                <span className="unslant">{busy ? 'RETRYING…' : 'RETRY REFUND ▸'}</span>
              </button>
            ) : (
              <div className="adm-row">
                <button className="adm-ghost" onClick={() => setMode('rejecting')} disabled={busy}>
                  {member ? (paid ? 'REFUND (JOINED BY INVITE)' : 'CLOSE (JOINED BY INVITE)') : paid ? 'REJECT + REFUND' : 'REJECT'}
                </button>
                {!member && (
                  <button className="btn-primary slant adm-btn" onClick={accept} disabled={busy}>
                    <span className="unslant">{busy ? 'APPROVING…' : 'ACCEPT ▸'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

function Q({ k, v }: { k: string; v: string }) {
  return (
    <div className="adm-q">
      <span className="adm-k">{k}</span>
      <p>{v}</p>
    </div>
  )
}

/** A member reported from a chat: what they saw (the request + the last messages, copied before the chat was deleted). */
function ReportCard({ r, onDone, onError }: { r: Report; onDone: () => void; onError: (e: string) => void }) {
  const [busy, setBusy] = useState(false)
  const who = r.snapshot.reported
  const c = r.snapshot.connection
  const resolve = async (hide: boolean) => {
    setBusy(true)
    const { data, error } = await supabase!.rpc('admin_resolve_report', { p_id: r.id, p_hide: hide })
    setBusy(false)
    if (error || !(data as { ok?: boolean } | null)?.ok) return onError(error?.message ?? 'Couldn’t update the report.')
    onDone()
  }
  const side = (id: string) => (id === r.reported_id ? (who?.name ?? 'Reported').toUpperCase() : 'REPORTER')
  return (
    <article className={`adm-card adm-card--${r.status === 'open' ? 'under_review' : 'approved'}`}>
      <div className="adm-who">
        <div className="adm-status">
          <span className={`adm-chip adm-chip--${r.status === 'open' ? 'refund_failed' : 'approved'}`}>
            {r.status === 'open' ? 'OPEN' : r.status === 'hidden' ? 'MEMBER HIDDEN' : 'RESOLVED'}
          </span>
        </div>
        <h2>{(who?.name ?? 'Unknown member').toUpperCase()}</h2>
        <p className="adm-role">{who?.role}</p>
        <dl className="adm-facts">
          <dt>REPORTED</dt>
          <dd>{ago(r.created_at)}</dd>
          <dt>CONNECTION</dt>
          <dd>
            {c.intent} · {c.status}
          </dd>
        </dl>
      </div>
      <div className="adm-answers">
        <Q k="WHAT HAPPENED (REPORTER)" v={r.reason ?? '—'} />
        {c.note && <Q k={`REQUEST NOTE (${side(c.from_id)})`} v={c.note} />}
        <div className="adm-q">
          <span className="adm-k">LAST MESSAGES ({r.snapshot.messages.length})</span>
          {r.snapshot.messages.length === 0 && <p>—</p>}
          {r.snapshot.messages.map((m, n) => (
            <p key={n}>
              <b>{side(m.from)}:</b> {m.body}
            </p>
          ))}
        </div>
        {r.status === 'open' && (
          <div className="adm-decide">
            <div className="adm-row">
              <button className="adm-ghost" onClick={() => resolve(false)} disabled={busy}>
                RESOLVE · NO ACTION
              </button>
              <button className="adm-btn adm-btn--reject slant" onClick={() => resolve(true)} disabled={busy || !r.reported_id}>
                <span className="unslant">{busy ? '…' : 'HIDE MEMBER ▸'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
