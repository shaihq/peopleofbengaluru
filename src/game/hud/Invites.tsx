'use client'

import { useEffect, useRef, useState } from 'react'
import { NOTE_MAX, daysLeft, inviteLink, useInvites, type Slot } from '../invites'
import { useDirectory } from '../people/directory'
import { isTyping, requestLook } from '../player/input'
import { useGame } from '../store'
import { isTouch } from '../device'

// YOUR INVITES (CLAUDE.md Phase 5D) — I, the INVITES button on your card, or the pause menu.
// design.md §10: an ink panel over the live street, one chunky slanted card per slot.

const isMemberNow = () => useDirectory.getState().me?.status === 'approved'

const canShare = () => isTouch && typeof navigator !== 'undefined' && typeof navigator.share === 'function'

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).toUpperCase()

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Share sheet on phones, clipboard everywhere else. */
async function hand(code: string, note: string | null) {
  const url = inviteLink(code)
  const toast = useGame.getState().showToast
  if (canShare()) {
    try {
      await navigator.share({ title: 'People of Bengaluru', text: `${note ? `${note}, ` : ''}you're invited to the city of designers and builders.`, url })
      return
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return
    }
  }
  if (await copy(url)) toast('LINK COPIED · SEND IT TO THEM', 'good')
  else toast('COULDN’T COPY · SELECT THE LINK AND COPY IT', 'bad')
}

/** The slot number, on a slanted block coloured by state: saffron ready, ink sent, green joined. */
function Num({ n, tone }: { n: number; tone: 'ready' | 'sent' | 'joined' }) {
  return (
    <span className={`iv-num iv-num--${tone} slant`} aria-hidden>
      <span className="unslant">{String(n).padStart(2, '0')}</span>
    </span>
  )
}

function Ready({ s, n }: { s: Slot; n: number }) {
  const busy = useInvites((x) => x.busy)
  const [note, setNote] = useState('')
  const make = async () => {
    const r = await useInvites.getState().create(s.code, note)
    if (!r.ok) return useGame.getState().showToast('COULDN’T MAKE THE LINK · TRY AGAIN', 'bad')
    setNote('')
    const copied = !canShare() && (await copy(inviteLink(s.code)))
    useGame.getState().showToast(copied ? 'LINK READY · COPIED' : 'LINK READY', 'good')
  }
  return (
    <div className="iv-pass iv-pass--ready">
      <Num n={n} tone="ready" />
      <div className="iv-pass-body">
        <b className="iv-pass-title">INVITE READY</b>
        <span className="iv-pass-sub">
          {s.renewed_from === null
            ? 'For someone you’d vouch for.'
            : s.renewed_from
              ? `Your link to ${s.renewed_from} went unused — here’s a fresh one.`
              : 'Your last link went unused — here’s a fresh one.'}
        </span>
        <div className="iv-pass-row">
          <input
            className="iv-input"
            value={note}
            maxLength={NOTE_MAX}
            placeholder="Who’s it for? (optional)"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation()
                void make()
              }
            }}
            aria-label="Who is this invite for (optional)"
          />
          <button className="iv-act slant" data-primary onClick={make} disabled={busy}>
            <span className="unslant">{busy ? 'MAKING…' : 'CREATE LINK ▸'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function Sent({ s, n }: { s: Slot; n: number }) {
  const url = inviteLink(s.code)
  return (
    <div className="iv-pass iv-pass--sent">
      <Num n={n} tone="sent" />
      <div className="iv-pass-body">
        <div className="iv-pass-head">
          <b className="iv-pass-title">{s.note ? `FOR ${s.note.toUpperCase()}` : 'LINK SENT'}</b>
          <span className="iv-left">{daysLeft(s.expires_at)}</span>
        </div>
        <div className="iv-pass-row">
          <input className="iv-input iv-input--link" value={url} readOnly onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />
          <button className="iv-act iv-act--quiet slant" data-primary onClick={() => hand(s.code, s.note)}>
            <span className="unslant">{canShare() ? 'SHARE ▸' : 'COPY'}</span>
          </button>
        </div>
        <span className="iv-pass-fine">
          Sent {s.sent_at ? shortDate(s.sent_at) : ''} · unused after 30 days, it expires and you get a fresh one
        </span>
      </div>
    </div>
  )
}

function Joined({ s, n }: { s: Slot; n: number }) {
  const j = s.joined!
  return (
    <div className="iv-pass iv-pass--joined">
      <Num n={n} tone="joined" />
      <div className="iv-pass-body">
        <div className="iv-pass-head">
          <b className="iv-pass-title">{j.name.split(' ')[0].toUpperCase()} JOINED</b>
          <span className="iv-left iv-left--joined">{shortDate(j.at)}</span>
        </div>
        <span className="iv-pass-sub">
          {j.role ? `${j.role} · ` : ''}in the city because you vouched for them
        </span>
      </div>
    </div>
  )
}

/** I — your invite codes. */
export function Invites() {
  const phase = useGame((s) => s.phase)
  const open = useGame((s) => s.invitesOpen)
  const setOpen = useGame((s) => s.setInvitesOpen)
  const member = useDirectory((s) => s.me?.status === 'approved')
  const slots = useInvites((s) => s.slots)
  const loaded = useInvites((s) => s.loaded)
  const error = useInvites((s) => s.error)
  const list = useRef<HTMLDivElement>(null)
  const ready = slots.filter((s) => s.state === 'available').length

  const close = () => {
    setOpen(false)
    requestLook()
  }

  // I = your invites (members), from the street
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = useGame.getState()
      if (e.code !== 'KeyI' || e.repeat || isTyping(e) || g.phase !== 'play' || !isMemberNow()) return
      if (g.openId || g.searchOpen || g.paused || g.portalOpen || g.travel || g.statusOpen || g.connectOpen) return
      e.preventDefault()
      g.setInvitesOpen(!g.invitesOpen)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) void useInvites.getState().load()
  }, [open])

  // links from the welcome email: /?invites
  useEffect(() => {
    if (phase !== 'play' || !member) return
    const url = new URL(window.location.href)
    if (!url.searchParams.has('invites')) return
    url.searchParams.delete('invites')
    window.history.replaceState(null, '', url)
    setOpen(true)
  }, [phase, member, setOpen])

  // Esc closes · ↑↓ move between the slots' actions (Enter presses the focused one)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close()
        return
      }
      if (e.code !== 'ArrowDown' && e.code !== 'ArrowUp') return
      const targets = Array.from(list.current?.querySelectorAll<HTMLElement>('[data-primary], .iv-pass--ready .iv-input') ?? [])
      if (!targets.length) return
      e.preventDefault()
      const i = targets.indexOf(document.activeElement as HTMLElement)
      const next = i < 0 ? 0 : (i + (e.code === 'ArrowDown' ? 1 : -1) + targets.length) % targets.length
      targets[next].focus()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  if (phase !== 'play' || !open || !member) return null

  return (
    <div className="cr iv">
      <div className="select-shade" />
      <div className="cr-panel iv-panel">
        <div className="cr-top">
          <span className="cr-tag slant">
            <span className="unslant">YOUR INVITES</span>
          </span>
          <button className="pp-close st-close" onClick={close} aria-label="Close">
            <span className="keycap">ESC</span>
          </button>
        </div>
        <h2 className="cr-title">BRING SOMEONE IN</h2>
        <p className="cr-copy st-lede">People you invite go live as soon as they’re done. No review.</p>
        {loaded && slots.length > 0 && (
          <div className="iv-tally">
            <span className="iv-tally-pips" aria-hidden>
              {slots.map((s) => (
                <i key={s.code} className={`slant iv-pip iv-pip--${s.state}`} />
              ))}
            </span>
            <span>
              <b>{ready}</b> OF {slots.length} LEFT
            </span>
          </div>
        )}

        <div className="iv-list" ref={list}>
          {error && !loaded ? (
            <div className="cn-empty">
              Couldn’t load your invites.{' '}
              <button className="gate-switch" onClick={() => useInvites.getState().load()}>
                RETRY
              </button>
            </div>
          ) : !loaded ? (
            <p className="cn-empty">Loading your invites…</p>
          ) : slots.length === 0 ? (
            <p className="cn-empty">No invites yet. Every member gets two.</p>
          ) : (
            slots.map((s, i) =>
              s.state === 'used' && s.joined ? (
                <Joined key={s.code} s={s} n={i + 1} />
              ) : s.state === 'sent' ? (
                <Sent key={s.code} s={s} n={i + 1} />
              ) : s.state === 'available' ? (
                <Ready key={s.code} s={s} n={i + 1} />
              ) : null,
            )
          )}
        </div>
      </div>
    </div>
  )
}
