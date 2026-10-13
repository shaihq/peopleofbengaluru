import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

// INVITES (CLAUDE.md 5D): founder codes — no owner, made here in batches with a label (who they're for).
// Track each one (unused / joined / revoked, and who joined with it), copy links, export a CSV,
// revoke a code that leaked. All through admin_* functions (supabase/migrations/20261013121743_admin_invites.sql).

type Row = {
  code: string
  state: 'available' | 'sent' | 'used' | 'revoked' | 'expired'
  note: string | null
  created_at: string
  used_at: string | null
  used_by: string | null
  used_name: string | null
  used_role: string | null
  used_status: string | null
}

type Filter = 'all' | 'unused' | 'joined' | 'revoked'

const unused = (r: Row) => r.state === 'available' || r.state === 'sent'
const link = (code: string) => `${window.location.origin}/?invite=${code}`
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—')

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function csv(rows: Row[]) {
  const q = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`
  const head = 'code,link,for,state,joined_name,joined_role,joined_at,created_at'
  const body = rows.map((r) =>
    [r.code, link(r.code), r.note, unused(r) ? 'unused' : r.state === 'used' ? 'joined' : r.state, r.used_name, r.used_role, r.used_at, r.created_at]
      .map(q)
      .join(','),
  )
  const blob = new Blob([[head, ...body].join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `founder-invites-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function InvitesAdmin({ onError }: { onError: (e: string) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [n, setN] = useState(10)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [fresh, setFresh] = useState<string[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [flash, setFlash] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase!.rpc('admin_founder_invites')
    if (error) return onError(error.message)
    setRows((data ?? []) as Row[])
  }, [onError])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 2200)
    return () => clearTimeout(id)
  }, [flash])

  const generate = async () => {
    const count = Math.max(1, Math.min(200, Math.round(n) || 0))
    setBusy(true)
    const { data, error } = await supabase!.rpc('admin_issue_invites', { p_n: count, p_note: label })
    setBusy(false)
    if (error) return onError(error.message)
    setFresh((data ?? []) as string[])
    setFilter('all')
    await load()
  }

  const copyLinks = async (codes: string[], what: string) => {
    if (!codes.length) return
    setFlash((await copy(codes.map(link).join('\n'))) ? `${what} COPIED` : 'COULDN’T COPY')
  }

  const stats = useMemo(() => {
    const all = rows ?? []
    return { total: all.length, unused: all.filter(unused).length, joined: all.filter((r) => r.state === 'used').length, revoked: all.filter((r) => r.state === 'revoked').length }
  }, [rows])

  const shown = useMemo(
    () =>
      (rows ?? []).filter((r) =>
        filter === 'unused' ? unused(r) : filter === 'joined' ? r.state === 'used' : filter === 'revoked' ? r.state === 'revoked' : true,
      ),
    [rows, filter],
  )

  return (
    <div className="adm-list">
      <section className="adm-inv-make">
        <div className="adm-inv-make-text">
          <span className="adm-k">FOUNDER CODES</span>
          <p>Each code lets one person in, live straight away, no review. They don’t expire until used or revoked.</p>
        </div>
        <div className="adm-row">
          <label className="adm-inv-field adm-inv-field--n">
            <span className="adm-k">HOW MANY</span>
            <input type="number" min={1} max={200} value={n} onChange={(e) => setN(Number(e.target.value))} />
          </label>
          <label className="adm-inv-field">
            <span className="adm-k">FOR (OPTIONAL)</span>
            <input
              value={label}
              maxLength={120}
              placeholder="Launch list · Design Twitter · Priya Sharma"
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !busy && generate()}
            />
          </label>
          <button className="btn-primary slant adm-btn" onClick={generate} disabled={busy}>
            <span className="unslant">{busy ? 'MAKING…' : `MAKE ${Math.max(1, Math.min(200, Math.round(n) || 0))} CODES ▸`}</span>
          </button>
        </div>
        {fresh.length > 0 && (
          <div className="adm-inv-fresh">
            <b>{fresh.length} NEW CODES</b>
            <button className="adm-ghost" onClick={() => copyLinks(fresh, `${fresh.length} LINKS`)}>
              COPY ALL LINKS
            </button>
          </div>
        )}
      </section>

      <div className="adm-inv-bar">
        <nav className="adm-inv-filters">
          {(
            [
              ['all', 'ALL', stats.total],
              ['unused', 'UNUSED', stats.unused],
              ['joined', 'JOINED', stats.joined],
              ['revoked', 'REVOKED', stats.revoked],
            ] as const
          ).map(([id, label, count]) => (
            <button key={id} className={`adm-tab slant${filter === id ? ' adm-tab--on' : ''}`} onClick={() => setFilter(id)}>
              <span className="unslant">
                {label} <em>{count}</em>
              </span>
            </button>
          ))}
        </nav>
        <div className="adm-row">
          {flash && <span className="adm-inv-flash">{flash}</span>}
          <button className="adm-ghost" onClick={() => copyLinks(shown.filter(unused).map((r) => r.code), 'UNUSED LINKS')} disabled={!shown.some(unused)}>
            COPY UNUSED LINKS
          </button>
          <button className="adm-ghost" onClick={() => csv(shown)} disabled={!shown.length}>
            EXPORT CSV
          </button>
        </div>
      </div>

      {rows === null ? (
        <p className="adm-empty">LOADING…</p>
      ) : shown.length === 0 ? (
        <p className="adm-empty">{rows.length ? 'NOTHING HERE' : 'NO FOUNDER CODES YET · MAKE SOME ABOVE'}</p>
      ) : (
        <div className="adm-inv-table">
          {shown.map((r) => (
            <InviteRow key={r.code} r={r} fresh={fresh.includes(r.code)} onChanged={load} onError={onError} onFlash={setFlash} />
          ))}
        </div>
      )}
    </div>
  )
}

function InviteRow({
  r,
  fresh,
  onChanged,
  onError,
  onFlash,
}: {
  r: Row
  fresh: boolean
  onChanged: () => void
  onError: (e: string) => void
  onFlash: (m: string) => void
}) {
  const [note, setNote] = useState(r.note ?? '')
  const [busy, setBusy] = useState(false)
  const kind = unused(r) ? 'unused' : r.state === 'used' ? 'joined' : r.state

  const saveNote = async () => {
    if (note.trim() === (r.note ?? '')) return
    const { error } = await supabase!.rpc('admin_set_invite_note', { p_code: r.code, p_note: note })
    if (error) return onError(error.message)
    onChanged()
  }

  const revoke = async () => {
    if (!window.confirm(`Revoke ${r.code}? It will stop working at the gate.`)) return
    setBusy(true)
    const { error } = await supabase!.rpc('admin_revoke_invite', { p_code: r.code })
    setBusy(false)
    if (error) return onError(error.message)
    onChanged()
  }

  return (
    <div className={`adm-inv-row adm-inv-row--${kind}${fresh ? ' adm-inv-row--fresh' : ''}`}>
      <span className="adm-inv-code">{r.code}</span>
      <input
        className="adm-inv-note"
        value={note}
        maxLength={120}
        placeholder="Who is it for?"
        onChange={(e) => setNote(e.target.value)}
        onBlur={saveNote}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        aria-label={`Who ${r.code} is for`}
      />
      <span className={`adm-chip adm-chip--${kind === 'joined' ? 'approved' : kind === 'unused' ? 'draft' : 'refund_failed'}`}>
        {kind === 'joined' ? 'JOINED' : kind === 'unused' ? 'UNUSED' : kind.toUpperCase()}
      </span>
      <span className="adm-inv-who">
        {r.state === 'used' ? (
          <>
            <b>{(r.used_name ?? 'Account deleted').toUpperCase()}</b>
            {r.used_role && <small>{r.used_role}</small>}
            <small>{day(r.used_at)}</small>
          </>
        ) : (
          <small>Made {day(r.created_at)}</small>
        )}
      </span>
      <span className="adm-inv-acts">
        {unused(r) && (
          <>
            <button className="adm-ghost" onClick={async () => onFlash((await copy(link(r.code))) ? `${r.code} LINK COPIED` : 'COULDN’T COPY')}>
              COPY LINK
            </button>
            <button className="adm-ghost adm-inv-revoke" onClick={revoke} disabled={busy}>
              REVOKE
            </button>
          </>
        )}
      </span>
    </div>
  )
}
