'use client'

import { useEffect, useState } from 'react'
import { INTENTS, intentOf, type Intent } from '@/lib/intents'
import { NOTE_MAX, SEND_ERRORS, connWith, groups, useConnect, type Conn } from '../connect'
import { openThread } from '../chat'
import { Thread, escInThread } from './Chat'
import type { Profile } from '../people/profiles'
import { getPeople, useDirectory } from '../people/directory'
import { getCharacter } from '../characters/roster'
import { useOnboarding } from '../onboarding'
import { isTyping, requestLook } from '../player/input'
import { useGame } from '../store'
import { isTouch } from '../device'
import { homeDistrict } from '../districts/registry'

// CONNECT (CLAUDE.md Phase 5G) — the profile-panel action, the Connections screen (C), the match
// moment and the chats (Chat.tsx). design.md §10: ink panels, slanted saffron actions, condensed caps.

const isMemberNow = () => useDirectory.getState().me?.status === 'approved'

function ago(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000
  if (s < 60) return 'JUST NOW'
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}M AGO`
  if (s < 86400) return `${Math.round(s / 3600)}H AGO`
  return `${Math.round(s / 86400)}D AGO`
}

function IntentPicker({ value, onPick }: { value: Intent | null; onPick: (i: Intent) => void }) {
  return (
    <div className="cn-intents">
      {INTENTS.map((i, n) => (
        <button key={i.id} className={`chip slant cn-intent${value === i.id ? ' chip--on' : ''}`} onClick={() => onPick(i.id)}>
          <span className="unslant">
            <span className="cn-intent-e">{i.emoji}</span> {i.label}
            {!isTouch && <span className="keycap cn-intent-k">{n + 1}</span>}
          </span>
        </button>
      ))}
    </div>
  )
}

/** The request as they'll see it: who, why, and your note. */
function RequestCard({ intent, note, from }: { intent: Intent; note: string; from: string }) {
  const i = intentOf(intent)
  return (
    <div className="cn-ask cn-ask--preview">
      <span className="cn-ask-e">{i.emoji}</span>
      <span>
        <b>
          {from.split(' ')[0].toUpperCase()} WANTS TO {i.label}
        </b>
        {note.trim() ? <q className="cn-note">{note.trim()}</q> : <em>No note</em>}
      </span>
    </div>
  )
}

type FlowStep = 'why' | 'note' | 'sent'

/**
 * CONNECT — takes over the whole profile panel as a short stepper: WHY → NOTE (optional) → sent.
 * Esc steps back; from the first step it returns to the profile.
 */
export function ConnectFlow({ p, onExit }: { p: Profile; onExit: () => void }) {
  const me = useDirectory((s) => s.me)
  const busy = useConnect((s) => s.busy)
  const [intent, setIntent] = useState<Intent | null>(null)
  const [note, setNote] = useState('')
  const [step, setStep] = useState<FlowStep>('why')
  const [err, setErr] = useState<string | null>(null)
  const steps: FlowStep[] = ['why', 'note']
  const at = steps.indexOf(step)
  const accent = getCharacter(p.character).accent
  const first = p.name.split(' ')[0]
  const left = NOTE_MAX - note.length

  const send = async () => {
    if (!intent) return setStep('why')
    setErr(null)
    const r = await useConnect.getState().send(p.id, intent, note)
    if (r.ok && r.state === 'matched') return onExit() // they'd already asked you: the match screen takes over
    if (r.ok) return setStep('sent')
    if (r.state === 'connected' || r.state === 'already_sent') return onExit()
    setErr(SEND_ERRORS[r.state] ?? SEND_ERRORS.error)
  }

  const next = () => {
    if (step === 'why' && intent) return setStep('note')
    if (step === 'note') return void send()
  }
  const back = () => {
    setErr(null)
    if (step === 'why' || step === 'sent') return onExit()
    setStep(steps[at - 1])
  }

  // Esc = back · 1–5 pick a reason · Enter = next (a note is one line, so Enter in it is next too)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = isTyping(e)
      if (e.code === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        back()
        return
      }
      if (typing) return
      // E would close the profile underneath: inside the flow it does nothing
      if (e.code === 'KeyE') {
        e.stopPropagation()
        return
      }
      if (step === 'why' && /^Digit[1-5]$/.test(e.code)) {
        e.preventDefault()
        setIntent(INTENTS[Number(e.code.slice(5)) - 1].id)
        setErr(null)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (step === 'sent') onExit()
        else next()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  const title: Record<FlowStep, string> = {
    why: `WHY MEET ${first.toUpperCase()}?`,
    note: 'ADD A NOTE',
    sent: 'REQUEST SENT',
  }

  return (
    <div className="pp-inner cf" key={step}>
      <div className="pp-top">
        <span className="pp-tag">CONNECT</span>
        {step !== 'sent' && (
          <>
            <span className="cr-step cf-step">
              STEP {at + 1} / {steps.length}
            </span>
            <span className="cr-pips cf-pips">
              {steps.map((x, i) => (
                <span key={x} className={i <= at ? 'on' : ''} />
              ))}
            </span>
          </>
        )}
        <button className="pp-close" onClick={back} aria-label={step === 'why' || step === 'sent' ? 'Back to profile' : 'Back'}>
          <span className="keycap">ESC</span>
        </button>
      </div>

      <div className="cf-to">
        <span className="cf-to-k">TO</span>
        <span className="cf-swatch" style={{ background: accent }} />
        <b>{p.name.toUpperCase()}</b>
        <em>{p.role}</em>
      </div>

      <h2 className="cr-title cf-title">{title[step]}</h2>

      {step === 'why' && (
        <>
          <p className="cr-copy cf-lede">Pick one. It’s the first thing they see.</p>
          <IntentPicker
            value={intent}
            onPick={(i) => {
              setIntent(i)
              setErr(null)
            }}
          />
        </>
      )}

      {step === 'note' && intent && (
        <>
          <p className="cr-copy cf-lede">
            Optional — but people say yes far more often when they know why you’re reaching out. One line is plenty.
          </p>
          <label className="cr-field cf-note">
            <span className="cr-label">
              YOUR NOTE <em className={left < 30 ? 'cr-count cr-count--low' : 'cr-count'}>{left}</em>
            </span>
            <textarea
              className="cr-answer"
              rows={3}
              value={note}
              maxLength={NOTE_MAX}
              autoFocus={!isTouch}
              placeholder={`Loved your work on ${p.building || 'your last project'} — free for a chai this week?`}
              onChange={(e) => setNote(e.target.value.replace(/\n/g, ' '))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.stopPropagation()
                  next()
                }
              }}
              aria-label={`A note to ${first} (optional)`}
            />
          </label>
          <span className="cr-label cf-preview-k">WHAT {first.toUpperCase()} SEES</span>
          <RequestCard intent={intent} note={note} from={me?.name ?? 'You'} />
          <p className="cn-fine">If {first} says yes, a chat opens between you two, right here in the city.</p>
        </>
      )}

      {step === 'sent' && intent && (
        <>
          <p className="cr-copy cf-lede">
            If {first} says yes, a chat opens between you two. If not, nothing happens and nobody is told.
          </p>
          <RequestCard intent={intent} note={note} from={me?.name ?? 'You'} />
          <p className="cn-fine">Requests nobody answers quietly disappear after 14 days. Track it under CONNECTIONS (C) → SENT.</p>
        </>
      )}

      {err && <div className="cr-error">{err}</div>}

      <div className="cr-nav cf-nav">
        {step !== 'sent' ? (
          <button className="pp-btn slant cr-back" onClick={back}>
            <span className="unslant">{step === 'why' ? '◀ PROFILE' : '◀ BACK'}</span>
          </button>
        ) : (
          <span />
        )}
        {step === 'why' && (
          <button className="btn-primary slant cr-next" disabled={!intent} onClick={next}>
            <span className="unslant">NEXT ▸</span>
          </button>
        )}
        {step === 'note' && (
          <button className="btn-primary slant cr-next" disabled={busy} onClick={next}>
            <span className="unslant">{busy ? 'SENDING…' : note.trim() ? 'SEND REQUEST ▸' : 'SEND WITHOUT A NOTE ▸'}</span>
          </button>
        )}
        {step === 'sent' && (
          <button className="btn-primary slant cr-next" onClick={onExit}>
            <span className="unslant">BACK TO PROFILE ▸</span>
          </button>
        )}
      </div>
    </div>
  )
}

/** Profile panel: CONNECT and its state with this one person. Sending a request opens ConnectFlow. */
export function ConnectBlock({ p, onConnect }: { p: Profile; onConnect: () => void }) {
  const member = useDirectory((s) => s.me?.status === 'approved')
  const signedIn = useDirectory((s) => !!s.me)
  const items = useConnect((s) => s.items)
  const busy = useConnect((s) => s.busy)
  const c = connWith(items, p.id)
  const [err, setErr] = useState<string | null>(null)
  const [unmatching, setUnmatching] = useState(false)

  useEffect(() => {
    setErr(null)
    setUnmatching(false)
  }, [p.id])

  if (p.sample) {
    return (
      <span className="pp-btn slant pp-btn--primary pp-btn--off" title="Sample profiles are for show">
        <span className="unslant">
          CONNECT <small>SAMPLE PROFILE · CONNECT WITH REAL PEOPLE</small>
        </span>
      </span>
    )
  }

  if (!member) {
    const become = () => {
      const ob = useOnboarding.getState()
      if (useDirectory.getState().me) {
        ob.fromProfile()
        ob.setStep(1)
      } else ob.setStep(0)
      useGame.getState().startCreate()
    }
    return (
      <div className="cn-block">
        <button className="pp-btn slant pp-btn--primary cn-btn" onClick={signedIn ? undefined : become} disabled={signedIn}>
          <span className="unslant">{signedIn ? 'CONNECT ONCE YOU’RE LIVE' : 'BECOME VISIBLE TO CONNECT'}</span>
        </button>
        <p className="cn-fine">Only people in the city can connect — so everyone you meet here is real.</p>
      </div>
    )
  }

  const respond = async (accept: boolean) => {
    if (!c) return
    const r = await useConnect.getState().respond(c.id, accept)
    if (!r.ok) return setErr('That request isn’t open any more.')
    if (!accept) useGame.getState().showToast('NOT NOW · THEY WON’T BE TOLD', 'info')
  }

  if (c?.state === 'matched') {
    const i = intentOf(c.intent)
    const first = c.other.name.split(' ')[0]
    const unmatch = async () => {
      useConnect.setState({ busy: true })
      await useConnect.getState().remove(c.id)
      useConnect.setState({ busy: false })
      setUnmatching(false)
      useGame.getState().showToast(`UNMATCHED · THE CHAT WITH ${first.toUpperCase()} IS GONE`, 'info')
    }
    return (
      <div className="cn-block">
        <div className="cn-state cn-state--match slant">
          <span className="unslant">
            ✓ CONNECTED · {i.emoji} {i.label}
          </span>
        </div>
        <button className="pp-btn slant pp-btn--primary cn-btn" onClick={() => void openThread(c.id)}>
          <span className="unslant">
            MESSAGE ▸{c.unread > 0 && <em className="hud-badge cn-unread">{c.unread}</em>}
          </span>
        </button>
        {unmatching ? (
          <div className="ch-confirm">
            <b>UNMATCH {first.toUpperCase()}?</b>
            <p>Your chat is deleted for both of you. You can connect again later.</p>
            <div className="ch-confirm-row">
              <button className="pp-btn slant cn-btn" onClick={() => setUnmatching(false)} disabled={busy}>
                <span className="unslant">CANCEL</span>
              </button>
              <button className="pp-btn slant cn-btn ch-danger" onClick={() => void unmatch()} disabled={busy}>
                <span className="unslant">{busy ? '…' : 'UNMATCH'}</span>
              </button>
            </div>
          </div>
        ) : (
          <p className="cn-fine">
            Changed your mind?{' '}
            <button className="gate-switch" onClick={() => setUnmatching(true)}>
              UNMATCH
            </button>
          </p>
        )}
      </div>
    )
  }

  if (c && c.dir === 'in') {
    const i = intentOf(c.intent)
    return (
      <div className="cn-block">
        <div className="cn-ask">
          <span className="cn-ask-e">{i.emoji}</span>
          <span>
            <b>WANTS TO {i.label}</b>
            {c.note && <q className="cn-note">{c.note}</q>}
            <em>with you · {ago(c.created_at)}</em>
          </span>
        </div>
        <div className="pp-links-row">
          <button className="pp-btn slant cn-btn" onClick={() => respond(false)} disabled={busy}>
            <span className="unslant">NOT NOW</span>
          </button>
          <button className="pp-btn slant pp-btn--primary cn-btn" onClick={() => respond(true)} disabled={busy}>
            <span className="unslant">ACCEPT ▸</span>
          </button>
        </div>
        {err && <div className="cr-error">{err}</div>}
      </div>
    )
  }

  if (c && c.dir === 'out') {
    const i = intentOf(c.intent)
    return (
      <div className="cn-block">
        <div className="cn-state slant">
          <span className="unslant">
            REQUEST SENT · {i.emoji} {i.label}
          </span>
        </div>
        <p className="cn-fine">
          Sent {ago(c.created_at).toLowerCase()}. If they say yes, a chat opens between you two.{' '}
          <button className="gate-switch" onClick={() => useConnect.getState().withdraw(c.id)}>
            WITHDRAW
          </button>
        </p>
      </div>
    )
  }

  return (
    <button className="pp-btn slant pp-btn--primary cn-btn" onClick={onConnect}>
      <span className="unslant">CONNECT ▸</span>
    </button>
  )
}

/** HUD button with the badge. Members only. */
/** How often the bell reminds you of something unseen. */
const NUDGE_MS = 40_000

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const firstName = (name: string) => name.split(/\s+/)[0].toUpperCase()

/**
 * Top right, beside FIND SOMEONE: the connections button (5G-C). It says what's waiting in
 * words, not a red dot: "PRIYA WANTS TO MEET" when it arrives (the bell swings), then a short
 * summary ("1 REQUEST · 1 MATCH") until you open it. [C] on desktop, like FIND SOMEONE [F].
 */
export function ConnectHud() {
  const member = useDirectory((s) => s.me?.status === 'approved')
  const items = useConnect((s) => s.items)
  const ring = useConnect((s) => s.ring)
  const [announce, setAnnounce] = useState<{ text: string; kind: 'ask' | 'match' } | null>(null)
  const [nudge, setNudge] = useState(0)
  const unseen = items.filter((c) => (!c.seen && ((c.dir === 'in' && c.state === 'pending') || (c.dir === 'out' && c.state === 'matched'))) || c.unread > 0).length

  // a reminder: while something you haven't seen waits, the bell swings again every 40 s —
  // silently (the chime only plays when it first arrives), never over a menu, and it stops
  // once you open the tray (that marks everything seen)
  useEffect(() => {
    if (!unseen) return
    const id = setInterval(() => {
      const g = useGame.getState()
      const busy = g.phase !== 'play' || !!g.openId || g.searchOpen || g.paused || g.connectOpen || g.statusOpen || g.invitesOpen || !!g.travel
      if (!busy && document.visibilityState === 'visible') setNudge((n) => n + 1)
    }, NUDGE_MS)
    return () => clearInterval(id)
  }, [unseen])

  // something arrived: name it for a few seconds, then settle to the summary
  useEffect(() => {
    if (!ring) return
    setNudge(0) // the arrival's own swing (a match rings bigger) takes over from reminders
    const s = useConnect.getState()
    const c =
      s.arrival?.conn ??
      [...s.items]
        .filter((x) => (ring.kind === 'match' ? x.state === 'matched' && x.dir === 'out' : x.state === 'pending' && x.dir === 'in'))
        .sort((x, y) => (y.decided_at ?? y.created_at).localeCompare(x.decided_at ?? x.created_at))[0]
    if (!c) return
    setAnnounce({ text: ring.kind === 'match' ? `IT’S A MATCH · ${firstName(c.other.name)}` : `${firstName(c.other.name)} WANTS TO MEET`, kind: ring.kind })
    const id = setTimeout(() => setAnnounce(null), 8000)
    return () => clearTimeout(id)
  }, [ring])

  if (!member) return null
  const asks = items.filter((c) => c.dir === 'in' && c.state === 'pending').length
  const matches = items.filter((c) => c.dir === 'out' && c.state === 'matched' && !c.seen).length
  const msgs = items.reduce((n, c) => n + (c.state === 'matched' ? c.unread : 0), 0)
  const summary = [asks && plural(asks, 'REQUEST', 'REQUESTS'), matches && plural(matches, 'MATCH', 'MATCHES'), msgs && plural(msgs, 'MESSAGE', 'MESSAGES')]
    .filter(Boolean)
    .join(' · ')
  const label = announce?.text ?? summary
  const short = asks + matches + msgs > 0 ? `${asks + matches + msgs} NEW` : ''
  const isMatch = announce ? announce.kind === 'match' : matches > 0 && !asks
  return (
    <button
      className={`slant hud-find hud-bell${label ? ' hud-bell--news' : ''}${isMatch ? ' hud-bell--match' : ''}`}
      onClick={() => useConnect.getState().openTray()}
      aria-label={label ? `Connections: ${label}` : 'Connections'}
    >
      {ring && <span key={`p${ring.n}`} className={`hud-bell-ping hud-bell-ping--${ring.kind}`} />}
      {label && <span className="hud-bell-shine" aria-hidden />}
      <span className="unslant">
        <svg
          key={`g${ring?.n ?? 0}-${nudge}`}
          className={`hud-bell-glyph${ring || nudge ? ` hud-bell-glyph--${nudge ? 'ask' : ring!.kind}` : ''}`}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path d="M12 2.4a1.7 1.7 0 0 1 1.7 1.7v.45c3 .72 5 3.3 5 6.45v3.1l1.95 2.65c.42.57.01 1.38-.7 1.38H4.05c-.71 0-1.12-.81-.7-1.38l1.95-2.65V11c0-3.15 2-5.73 5-6.45V4.1A1.7 1.7 0 0 1 12 2.4Z" />
          <path d="M9.4 19.2h5.2a2.6 2.6 0 0 1-5.2 0Z" />
        </svg>
        {label && (
          <span className="hud-bell-label" key={label}>
            <span className="hud-bell-long">{label}</span>
            <span className="hud-bell-short">{short}</span>
          </span>
        )}
        <span className="keycap">C</span>
      </span>
    </button>
  )
}

/** Who someone is at a glance: their character's colour + initials (rendered portraits: 5G-D). */
function Portrait({ who, size = 'm' }: { who: Conn['other']; size?: 's' | 'm' }) {
  const accent = getCharacter(who.character).accent
  const n = parseInt(accent.slice(1), 16)
  const light = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.5
  const ini = who.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span className={`cn-face cn-face--${size}`} style={{ ['--accent' as string]: accent, color: light ? '#1C1F2B' : '#FFF6E5' }}>
      {ini}
    </span>
  )
}

/** Walk to them: the finder's route (through the portal if they live in another district). */
function walkTo(id: string) {
  const person = getPeople().find((x) => x.id === id)
  if (!person) return false
  const g = useGame.getState()
  g.setConnectOpen(false)
  const there = homeDistrict(person.location)
  if (there === g.district) g.track(id)
  else {
    g.setPortalFor({ id, district: there })
    g.track('portal')
  }
  return true
}

/** Slides in from the right when a request or match arrives while you play (5G-C). */
export function ConnectArrival() {
  const arrival = useConnect((s) => s.arrival)
  const busy = useGame((s) => s.phase !== 'play' || !!s.openId || s.searchOpen || s.paused || s.connectOpen || !!s.travel || s.statusOpen)
  const [hold, setHold] = useState(false)
  useEffect(() => {
    if (!arrival || hold) return
    const id = setTimeout(() => useConnect.getState().dismissArrival(), 6500)
    return () => clearTimeout(id)
  }, [arrival, hold])
  if (!arrival || busy) return null
  const { conn: c, more } = arrival
  const i = intentOf(c.intent)
  const matched = c.state === 'matched'
  const view = () => (matched ? useConnect.getState().showMatch(c.id) : useConnect.getState().openTray(c.id))
  const accept = async () => {
    useConnect.getState().dismissArrival()
    await useConnect.getState().respond(c.id, true)
  }
  return (
    <div
      className={`cn-arrive slant${matched ? ' cn-arrive--match' : ''}`}
      key={c.id + c.state}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      role="status"
    >
      <span className="unslant cn-arrive-body">
        <span className="cn-arrive-top">
          <Portrait who={c.other} />
          <span className="cn-arrive-who">
            <span className="cn-arrive-k">{matched ? 'IT’S A MATCH' : 'WANTS TO MEET YOU'}</span>
            <b>{c.other.name.toUpperCase()}</b>
            <span className="cn-arrive-intent">
              <span className="cn-arrive-e">{i.emoji}</span> {matched ? `You both want to ${i.verb}` : `wants to ${i.verb}`}
            </span>
          </span>
          <button className="cn-arrive-x" onClick={() => useConnect.getState().dismissArrival()} aria-label="Dismiss">
            ×
          </button>
        </span>
        {!matched && c.note && <q className="cn-arrive-note">{c.note}</q>}
        <span className="cn-arrive-actions">
          {!matched && (
            <button className="pp-btn slant pp-btn--primary cn-btn" onClick={accept}>
              <span className="unslant">ACCEPT</span>
            </button>
          )}
          <button className={`pp-btn slant cn-btn${matched ? ' pp-btn--primary' : ''}`} onClick={view}>
            <span className="unslant">
              VIEW {!isTouch && <span className="keycap">C</span>}
            </span>
          </button>
          {more > 0 && <span className="cn-arrive-more">+{more} more</span>}
        </span>
      </span>
    </div>
  )
}

/** IT'S A MATCH — both said yes; the chat opens from here. */
function Match({ c, onBack }: { c: Conn; onBack: () => void }) {
  const me = useDirectory((s) => s.me)
  const i = intentOf(c.intent)
  return (
    <div className="cn-match">
      <span className="gate-chip gate-chip--open">
        <span className="np-dot" /> IT’S A MATCH
      </span>
      <div className="cn-pair">
        <span>{(me?.name ?? 'YOU').toUpperCase()}</span>
        <span className="cn-pair-e">{i.emoji}</span>
        <span>{c.other.name.toUpperCase()}</span>
      </div>
      <h2 className="cr-title cn-match-title">BOTH OF YOU WANT TO {i.label}.</h2>
      <p className="cr-copy">Say hi — you both want to {i.verb}, so you’re expected. Suggest a time and a place.</p>
      <div className="cr-nav">
        <button className="pp-btn slant cr-back" onClick={onBack}>
          <span className="unslant">◀ ALL CONNECTIONS</span>
        </button>
        <button className="btn-primary slant cr-next" onClick={() => void openThread(c.id)}>
          <span className="unslant">SAY HI ▸</span>
        </button>
      </div>
    </div>
  )
}

/** Someone asked you: who, why, what they said — then one clear decision. */
function AskCard({ c, focus, i: idx }: { c: Conn; focus: boolean; i: number }) {
  const busy = useConnect((s) => s.busy)
  const [leaving, setLeaving] = useState(false)
  const i = intentOf(c.intent)
  const notNow = () => {
    setLeaving(true)
    setTimeout(async () => {
      await useConnect.getState().respond(c.id, false)
      useGame.getState().showToast('NOT NOW · THEY WON’T BE TOLD', 'info')
    }, 220)
  }
  return (
    <div
      className={`cn-card${focus ? ' cn-card--focus' : ''}${!c.seen ? ' cn-card--new' : ''}${leaving ? ' cn-card--out' : ''}`}
      style={{ ['--i' as string]: idx }}
      data-id={c.id}
    >
      <div className="cn-card-main">
        <div className="cn-card-head">
          <Portrait who={c.other} />
          <span className="cn-card-who">
            <b>{c.other.name.toUpperCase()}</b>
            <em>
              {c.other.role} · {c.other.location}
            </em>
          </span>
          <small className="cn-card-ago">{ago(c.created_at)}</small>
        </div>
        <span className="cn-chip">
          <span className="cn-chip-e">{i.emoji}</span> {i.label}
        </span>
        {c.note && <p className="cn-bubble">{c.note}</p>}
      </div>
      <div className="cn-foot">
        <button className="cn-foot-btn" disabled={busy || leaving} onClick={notNow}>
          <span>NOT NOW</span>
        </button>
        <button className="cn-foot-btn cn-foot-btn--go" disabled={busy || leaving} onClick={() => useConnect.getState().respond(c.id, true)}>
          <span>ACCEPT ▸</span>
        </button>
      </div>
    </div>
  )
}

/** You both said yes: the chat — its last line and unread — and where they are in the city. */
function ChatCard({ c, focus, i: idx }: { c: Conn; focus: boolean; i: number }) {
  const i = intentOf(c.intent)
  const there = getPeople().some((x) => x.id === c.other.id)
  const fresh = c.unread > 0 || (c.dir === 'out' && !c.seen)
  return (
    <div className={`cn-card cn-card--match${focus ? ' cn-card--focus' : ''}`} style={{ ['--i' as string]: idx }} data-id={c.id}>
      <div className="cn-card-main">
        <div className="cn-card-head">
          <Portrait who={c.other} />
          <span className="cn-card-who">
            <b>{c.other.name.toUpperCase()}</b>
            <em>{c.other.role}</em>
          </span>
          {c.unread > 0 ? <em className="cn-unread-pill">{c.unread} NEW</em> : <small className="cn-card-ago">{ago(c.last?.at ?? c.decided_at ?? c.created_at)}</small>}
        </div>
        <span className="cn-chip cn-chip--match">
          ✓ MATCHED · <span className="cn-chip-e">{i.emoji}</span> {i.label}
        </span>
        {c.last ? (
          <p className={`cn-bubble cn-bubble--last${c.unread > 0 ? ' cn-bubble--unread' : ''}`}>
            {c.last.mine && <span className="cn-bubble-you">YOU: </span>}
            {c.last.body}
          </p>
        ) : (
          fresh && <p className="cn-bubble cn-bubble--last">You both want to {i.verb}. Say hi.</p>
        )}
      </div>
      <div className="cn-foot">
        {there ? (
          <button className="cn-foot-btn" onClick={() => walkTo(c.other.id)}>
            <span>WALK TO THEM</span>
          </button>
        ) : (
          <span className="cn-foot-btn cn-foot-btn--off">
            <span>NOT IN THE CITY NOW</span>
          </span>
        )}
        <button className="cn-foot-btn cn-foot-btn--match" onClick={() => void openThread(c.id)}>
          <span>{c.last ? 'MESSAGE ▸' : 'SAY HI ▸'}</span>
        </button>
      </div>
    </div>
  )
}

/** You asked: small, out of the way. */
function SentCard({ c }: { c: Conn }) {
  const i = intentOf(c.intent)
  return (
    <div className="cn-sent">
      <Portrait who={c.other} size="s" />
      <span className="cn-sent-who">
        <b>{c.other.name.toUpperCase()}</b>
        <em>
          {i.emoji} {i.verb} · {ago(c.created_at)}
        </em>
      </span>
      <button className="gate-switch" onClick={() => useConnect.getState().withdraw(c.id)}>
        WITHDRAW
      </button>
    </div>
  )
}

/** Email on or off (requests, matches, unread messages). */
function EmailSetting() {
  const emails = useConnect((s) => s.emails)
  const setEmails = useConnect((s) => s.setEmails)
  return (
    <div className="cn-you">
      <button className={`cr-toggle${emails ? ' cr-toggle--on' : ''}`} onClick={() => setEmails(!emails)}>
        <span className="cr-switch" />
        <span>
          <b>EMAIL ME</b>
          <em>When someone wants to connect, when it’s a match, and when a message waits for you</em>
        </span>
      </button>
    </div>
  )
}

/** C — the connections tray: a pane from the right; the city stays in view (5G-C). */
export function Connections() {
  const phase = useGame((s) => s.phase)
  const open = useGame((s) => s.connectOpen)
  const setOpen = useGame((s) => s.setConnectOpen)
  const member = useDirectory((s) => s.me?.status === 'approved')
  const items = useConnect((s) => s.items)
  const matchId = useConnect((s) => s.matchId)
  const focus = useConnect((s) => s.focus)
  const showMatch = useConnect((s) => s.showMatch)
  const threadId = useConnect((s) => s.threadId)
  const showThread = useConnect((s) => s.showThread)
  const [settings, setSettings] = useState(false)
  const [sentOpen, setSentOpen] = useState(false)
  const { requests, matches, sent } = groups(items)
  const match = matchId ? items.find((c) => c.id === matchId) : undefined
  const thread = threadId ? items.find((c) => c.id === threadId && c.state === 'matched') : undefined
  const close = () => {
    setOpen(false)
    showMatch(null)
    showThread(null)
    useConnect.setState({ focus: null })
    requestLook()
  }
  // C = connections (members), from the street; with a card on screen, C opens the tray on it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = useGame.getState()
      if (e.code !== 'KeyC' || e.repeat || isTyping(e) || g.phase !== 'play' || !isMemberNow()) return
      if (g.openId || g.searchOpen || g.paused || g.portalOpen || g.travel || g.statusOpen || g.invitesOpen) return
      e.preventDefault()
      if (g.connectOpen) return g.setConnectOpen(false)
      const a = useConnect.getState().arrival
      if (a?.conn.state === 'matched') useConnect.getState().showMatch(a.conn.id)
      else useConnect.getState().openTray(a?.conn.id ?? null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  // opening: load and mark seen
  useEffect(() => {
    if (!open) return
    setSettings(false)
    useConnect.getState().dismissArrival()
    void useConnect
      .getState()
      .load()
      .then(() => useConnect.getState().markSeen())
  }, [open])
  // the focused card scrolls into view
  useEffect(() => {
    if (!open || !focus) return
    const id = setTimeout(() => document.querySelector(`.cn-card[data-id="${focus}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 260)
    return () => clearTimeout(id)
  }, [open, focus, items])
  // links from the emails: /?connections
  useEffect(() => {
    if (phase !== 'play' || !member) return
    const url = new URL(window.location.href)
    if (!url.searchParams.has('connections')) return
    url.searchParams.delete('connections')
    window.history.replaceState(null, '', url)
    setOpen(true)
  }, [phase, member, setOpen])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      const st = useConnect.getState()
      if (st.threadId && escInThread()) return // the chat's ••• menu closes first
      if (st.threadId) showThread(null)
      else if (st.matchId) showMatch(null)
      else close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })
  if (phase !== 'play' || !open || !member) return null
  const nothing = !requests.length && !matches.length && !sent.length
  let k = 0
  return (
    <div className="cn-tray-wrap" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <aside className="cn-tray" aria-label="Connections">
        <header className="cn-tray-top">
          <span className="cn-tray-k">CONNECTIONS</span>
          <button
            className={`cn-gear${settings ? ' cn-gear--on' : ''}`}
            onClick={() => setSettings((v) => !v)}
            aria-label="Email settings"
            aria-expanded={settings}
          >
            ⚙
          </button>
          <button className="pp-close" onClick={close} aria-label="Close">
            <span className="keycap">ESC</span>
          </button>
        </header>

        {settings ? (
          <div className="cn-tray-scroll">
            <EmailSetting />
          </div>
        ) : thread ? (
          <div className="cn-tray-chat" key={`t${thread.id}`}>
            <Thread c={thread} onBack={() => showThread(null)} />
          </div>
        ) : match ? (
          <div className="cn-tray-scroll" key={match.id}>
            <Match c={match} onBack={() => showMatch(null)} />
          </div>
        ) : (
          <div className="cn-tray-scroll">
            {nothing && (
              <div className="cn-empty-tray">
                <b>NOBODY YET</b>
                <p>Set a status (N) so people know what you’re up for, or find someone (F) and hit CONNECT on their profile.</p>
              </div>
            )}
            {requests.length > 0 && (
              <section className="cn-sec">
                <h3 className="cn-sec-k cn-sec-k--hot">
                  NEEDS YOU <em>{requests.length}</em>
                </h3>
                {requests.map((c) => (
                  <AskCard key={c.id} c={c} focus={focus === c.id} i={k++} />
                ))}
              </section>
            )}
            {matches.length > 0 && (
              <section className="cn-sec">
                <h3 className="cn-sec-k">
                  CHATS <em>{matches.length}</em>
                </h3>
                {matches.map((c) => (
                  <ChatCard key={c.id} c={c} focus={focus === c.id} i={k++} />
                ))}
              </section>
            )}
            {sent.length > 0 && (
              <section className="cn-sec">
                <button className="cn-sec-k cn-sec-toggle" onClick={() => setSentOpen((v) => !v)} aria-expanded={sentOpen}>
                  WAITING ON THEM <em>{sent.length}</em> <span className="cn-chev">{sentOpen ? '▾' : '▸'}</span>
                </button>
                {sentOpen && sent.map((c) => <SentCard key={c.id} c={c} />)}
              </section>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}
