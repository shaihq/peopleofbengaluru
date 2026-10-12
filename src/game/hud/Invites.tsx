'use client'

import { useEffect, useRef, useState } from 'react'
import { inviteLink, useInvites, type Slot } from '../invites'
import { useDirectory } from '../people/directory'
import { isTyping, requestLook } from '../player/input'
import { useGame } from '../store'
import { isTouch } from '../device'

// YOUR INVITES (CLAUDE.md Phase 5D) — the ticket in the HUD, I, the INVITES button on your card, or the pause menu.
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

/** Share sheet on phones, clipboard everywhere else; either way the code counts as sent. */
async function hand(s: Slot) {
  const url = inviteLink(s.code)
  const toast = useGame.getState().showToast
  const sent = () => s.state === 'available' && void useInvites.getState().sent(s.code)
  if (canShare()) {
    try {
      await navigator.share({ title: 'People of Bengaluru', text: 'You’re invited to the city of designers and builders.', url })
      return sent()
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return
    }
  }
  if (await copy(url)) {
    toast('INVITE COPIED · SEND IT TO SOMEONE', 'good')
    sent()
  } else toast('COULDN’T COPY · TRY AGAIN', 'bad')
}

/** The slot number, on a slanted block: saffron while it's yours to give, green once used. */
function Num({ n, used }: { n: number; used?: boolean }) {
  return (
    <span className={`iv-num iv-num--${used ? 'used' : 'ready'} slant`} aria-hidden>
      <span className="unslant">{String(n).padStart(2, '0')}</span>
    </span>
  )
}

/** A code still to give: the code itself and one button. */
function Code({ s, n }: { s: Slot; n: number }) {
  return (
    <div className="iv-pass">
      <Num n={n} />
      <div className="iv-pass-body iv-pass-body--code">
        <b className="iv-pass-title iv-code">{s.code}</b>
        <button className="iv-act slant" data-primary onClick={() => hand(s)}>
          <span className="unslant">{canShare() ? 'SHARE ▸' : 'COPY'}</span>
        </button>
      </div>
    </div>
  )
}

function Used({ s, n }: { s: Slot; n: number }) {
  const j = s.joined
  return (
    <div className="iv-pass iv-pass--used">
      <Num n={n} used />
      <div className="iv-pass-body">
        <div className="iv-pass-head">
          <b className="iv-pass-title">{j ? `USED BY ${j.name.toUpperCase()}` : 'USED'}</b>
          {j && <span className="iv-left">{shortDate(j.at)}</span>}
        </div>
        {j?.role && <span className="iv-pass-sub">{j.role}</span>}
      </div>
    </div>
  )
}

// the ticket's count stays fresh, and a code used meanwhile shows up as "PRIYA JOINED"
const REFRESH_MS = 120_000

/**
 * The ticket in the HUD, beside the bell: how many codes you can still give, one tap to your invites.
 * Ink like the bell (a signal, not the main action); someone joining with your code turns it green for a moment.
 */
export function InvitesHud() {
  const member = useDirectory((s) => s.me?.status === 'approved')
  const slots = useInvites((s) => s.slots)
  const news = useInvites((s) => s.news)
  const [announce, setAnnounce] = useState<string | null>(null)

  useEffect(() => {
    if (!member) return
    const load = () => {
      if (document.visibilityState === 'visible') void useInvites.getState().load()
    }
    load()
    const id = setInterval(load, REFRESH_MS)
    document.addEventListener('visibilitychange', load)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', load)
    }
  }, [member])

  useEffect(() => {
    if (!news) return
    setAnnounce(`${news.name.split(/\s+/)[0].toUpperCase()} JOINED`)
    const id = setTimeout(() => setAnnounce(null), 8000)
    return () => clearTimeout(id)
  }, [news])

  if (!member) return null
  const ready = slots.filter((s) => s.state !== 'used').length
  return (
    <button
      className={`slant hud-find hud-bell hud-tix${announce ? ' hud-bell--news hud-bell--match' : ''}`}
      onClick={() => useGame.getState().setInvitesOpen(true)}
      aria-label={announce ?? (ready ? `Your invites: ${ready} to give` : 'Your invites')}
    >
      {announce && <span key={`p${news!.n}`} className="hud-bell-ping hud-bell-ping--match" />}
      <span className="unslant">
        <svg key={`g${news?.n ?? 0}`} className={`hud-bell-glyph hud-tix-glyph${announce ? ' hud-bell-glyph--match' : ''}`} viewBox="0 0 24 24" aria-hidden>
          <path
            fillRule="evenodd"
            d="M4 5h16a2 2 0 0 1 2 2v2.6a2.4 2.4 0 0 0 0 4.8V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2.6a2.4 2.4 0 0 0 0-4.8V7a2 2 0 0 1 2-2ZM14.6 7.4h1.3v2.1h-1.3ZM14.6 10.95h1.3v2.1h-1.3ZM14.6 14.5h1.3v2.1h-1.3Z"
          />
        </svg>
        {announce ? (
          <span className="hud-bell-label" key={announce}>
            {announce}
          </span>
        ) : (
          ready > 0 && <b className="hud-tix-n">{ready}</b>
        )}
        <span className="keycap">I</span>
      </span>
    </button>
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
  const ready = slots.filter((s) => s.state !== 'used').length

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
      const targets = Array.from(list.current?.querySelectorAll<HTMLElement>('[data-primary]') ?? [])
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
                <i key={s.code} className={`slant iv-pip iv-pip--${s.state === 'used' ? 'used' : 'available'}`} />
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
            slots.map((s, i) => (s.state === 'used' ? <Used key={s.code} s={s} n={i + 1} /> : <Code key={s.code} s={s} n={i + 1} />))
          )}
        </div>
      </div>
    </div>
  )
}
