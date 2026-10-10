'use client'

import { useEffect, useState } from 'react'
import { INTENTS, intentOf, type Intent } from '@/lib/intents'
import {
  METHODS,
  NOTE_MAX,
  SEND_ERRORS,
  connWith,
  contactHref,
  contactLabel,
  methodOf,
  unseenCount,
  useConnect,
  type Conn,
  type ContactMethod,
  type Tab,
} from '../connect'
import type { Profile } from '../people/profiles'
import { getPeople, useDirectory } from '../people/directory'
import { getCharacter } from '../characters/roster'
import { useOnboarding } from '../onboarding'
import { isTyping, requestLook } from '../player/input'
import { useGame } from '../store'
import { isTouch } from '../device'

// CONNECT (CLAUDE.md Phase 5G) — the profile-panel action, the Connections screen (C) and the
// match moment. design.md §10: ink panels, slanted saffron actions, condensed caps.

const isMemberNow = () => useDirectory.getState().me?.status === 'approved'

function ago(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000
  if (s < 60) return 'JUST NOW'
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}M AGO`
  if (s < 86400) return `${Math.round(s / 3600)}H AGO`
  return `${Math.round(s / 86400)}D AGO`
}

/** "How should they reach you?" — asked inline the first time it's needed. */
export function ContactForm({
  onSaved,
  cta = 'SAVE ▸',
  focus = true,
  label = true,
}: {
  onSaved?: () => void
  cta?: string
  focus?: boolean
  /** off when a screen title already asks the question */
  label?: boolean
}) {
  const current = useConnect((s) => s.contact)
  const save = useConnect((s) => s.saveContact)
  const [method, setMethod] = useState<ContactMethod>(current?.method ?? 'whatsapp')
  const [value, setValue] = useState(current ? contactLabel(current) : '')
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const m = methodOf(method)

  const submit = async () => {
    setSaving(true)
    const r = await save(method, value)
    setSaving(false)
    if (!r.ok) return setErr(r.error ?? 'Couldn’t save it.')
    setErr(null)
    onSaved?.()
  }

  return (
    <div className="cn-contact-form">
      {label && <span className="cr-label">HOW SHOULD THEY REACH YOU?</span>}
      <div className="cr-chips cr-chips--tight cn-methods">
        {METHODS.map((x) => (
          <button
            key={x.id}
            className={`chip slant${method === x.id ? ' chip--on' : ''}`}
            onClick={() => {
              setMethod(x.id)
              if (current?.method !== x.id) setValue('')
              setErr(null)
            }}
          >
            <span className="unslant chip-name">{x.label}</span>
          </button>
        ))}
      </div>
      <label className="cr-field cn-field">
        <input
          value={value}
          placeholder={m.placeholder}
          inputMode={method === 'whatsapp' ? 'tel' : method === 'email' ? 'email' : 'text'}
          autoComplete="off"
          spellCheck={false}
          autoFocus={focus && !isTouch}
          onChange={(e) => {
            setValue(e.target.value)
            setErr(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.stopPropagation()
              void submit()
            }
          }}
          aria-label={m.label}
        />
      </label>
      <p className="cn-fine">
        {m.hint} <b>Only shown to people you match with.</b>
      </p>
      {err && <div className="cr-error">{err}</div>}
      <button className="pp-btn slant pp-btn--primary cn-btn" onClick={submit} disabled={saving || !value.trim()}>
        <span className="unslant">{saving ? 'SAVING…' : cta}</span>
      </button>
    </div>
  )
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

type FlowStep = 'why' | 'note' | 'reach' | 'sent'

/**
 * CONNECT — takes over the whole profile panel as a short stepper:
 * WHY → NOTE (optional) → HOW THEY REACH YOU (only the first time) → sent.
 * Esc steps back; from the first step it returns to the profile.
 */
export function ConnectFlow({ p, onExit }: { p: Profile; onExit: () => void }) {
  const me = useDirectory((s) => s.me)
  const contact = useConnect((s) => s.contact)
  const busy = useConnect((s) => s.busy)
  const [intent, setIntent] = useState<Intent | null>(null)
  const [note, setNote] = useState('')
  const [step, setStep] = useState<FlowStep>('why')
  const [err, setErr] = useState<string | null>(null)
  // the contact step is decided once, when the flow opens, so the step count doesn't jump after saving
  const [needContact] = useState(() => !useConnect.getState().contact)
  const steps: FlowStep[] = needContact ? ['why', 'note', 'reach'] : ['why', 'note']
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
    if (r.state === 'no_contact') return setStep('reach')
    if (r.state === 'connected' || r.state === 'already_sent') return onExit()
    setErr(SEND_ERRORS[r.state] ?? SEND_ERRORS.error)
  }

  const next = () => {
    if (step === 'why' && intent) return setStep('note')
    if (step === 'note') return contact ? void send() : setStep('reach')
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
      if (e.key === 'Enter' && step !== 'reach') {
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
    reach: 'HOW SHOULD THEY REACH YOU?',
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
          <p className="cn-fine">Your contact stays hidden until they say yes. Don’t put it in the note.</p>
        </>
      )}

      {step === 'reach' && (
        <>
          <p className="cr-copy cf-lede">
            Asked once. If {first} says yes, this is how they’ll reach you — nobody else ever sees it.
          </p>
          <ContactForm label={false} cta={busy ? 'SENDING…' : 'SAVE + SEND ▸'} onSaved={send} />
        </>
      )}

      {step === 'sent' && intent && (
        <>
          <p className="cr-copy cf-lede">
            If {first} says yes, you’ll both see how to reach each other. If not, nothing happens and nobody is told.
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
            <span className="unslant">{!contact ? 'NEXT ▸' : busy ? 'SENDING…' : note.trim() ? 'SEND REQUEST ▸' : 'SEND WITHOUT A NOTE ▸'}</span>
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
  // a request to you: accept → (contact)
  const [needContact, setNeedContact] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setNeedContact(false)
    setErr(null)
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
    if (r.state === 'no_contact') return setNeedContact(true)
    if (!r.ok) return setErr('That request isn’t open any more.')
    if (!accept) useGame.getState().showToast('NOT NOW · THEY WON’T BE TOLD', 'info')
  }

  if (c?.state === 'matched') {
    const i = intentOf(c.intent)
    return (
      <div className="cn-block">
        <div className="cn-state cn-state--match slant">
          <span className="unslant">
            ✓ CONNECTED · {i.emoji} {i.label}
          </span>
        </div>
        <button className="pp-btn slant pp-btn--primary cn-btn" onClick={() => useConnect.getState().showMatch(c.id)}>
          <span className="unslant">TAKE IT FROM HERE ▸</span>
        </button>
      </div>
    )
  }

  if (c && c.dir === 'in') {
    const i = intentOf(c.intent)
    if (needContact)
      return (
        <div className="cn-block">
          <ContactForm cta="SAVE + ACCEPT ▸" onSaved={() => respond(true)} />
        </div>
      )
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
          Sent {ago(c.created_at).toLowerCase()}. If they say yes, you’ll both see how to reach each other.{' '}
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
export function ConnectHud() {
  const member = useDirectory((s) => s.me?.status === 'approved')
  const n = useConnect((s) => unseenCount(s.items))
  if (!member) return null
  return (
    <button className="slant hud-find hud-connect" onClick={() => useGame.getState().setConnectOpen(true)}>
      <span className="unslant">
        CONNECTIONS {n > 0 && <em className="hud-badge">{n}</em>} <span className="keycap">C</span>
      </span>
    </button>
  )
}

/** IT'S A MATCH — both said yes; the introduction. */
function Match({ c, onBack }: { c: Conn; onBack: () => void }) {
  const me = useDirectory((s) => s.me)
  const [confirm, setConfirm] = useState(false)
  const i = intentOf(c.intent)
  const there = getPeople().some((x) => x.id === c.other.id)
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
      {c.contact ? (
        <>
          <div className="cn-reveal slant">
            <span className="unslant">
              <span className="cn-reveal-k">{methodOf(c.contact.method).label}</span>
              <span className="cn-reveal-v">{contactLabel(c.contact)}</span>
            </span>
          </div>
          <a className="pp-btn slant pp-btn--primary cn-btn" href={contactHref(c.contact)} target="_blank" rel="noopener noreferrer">
            <span className="unslant">TAKE IT FROM HERE →</span>
          </a>
        </>
      ) : (
        <p className="cr-copy">They haven’t left a way to reach them right now. Check back soon.</p>
      )}
      <p className="cn-fine">
        Say hi and mention the city — you both want to {i.verb}, so you’re expected.
      </p>
      <div className="cr-nav">
        <button className="pp-btn slant cr-back" onClick={onBack}>
          <span className="unslant">◀ ALL CONNECTIONS</span>
        </button>
        {there && (
          <button
            className="pp-btn slant cn-find"
            onClick={() => {
              useGame.getState().setConnectOpen(false)
              useGame.getState().track(c.other.id)
            }}
          >
            <span className="unslant">FIND THEM ▸</span>
          </button>
        )}
      </div>
      <button className={`cn-remove${confirm ? ' cn-remove--confirm' : ''}`} onClick={() => (confirm ? useConnect.getState().remove(c.id) : setConfirm(true))}>
        {confirm ? 'CLICK AGAIN — YOU’LL BOTH LOSE EACH OTHER’S CONTACT' : 'REMOVE CONNECTION'}
      </button>
    </div>
  )
}

function Row({ c }: { c: Conn }) {
  const busy = useConnect((s) => s.busy)
  const contact = useConnect((s) => s.contact)
  const [needContact, setNeedContact] = useState(false)
  const i = intentOf(c.intent)
  const accept = async () => {
    if (!contact) return setNeedContact(true)
    const r = await useConnect.getState().respond(c.id, true)
    if (r.state === 'no_contact') setNeedContact(true)
  }
  return (
    <div className={`cn-row${!c.seen ? ' cn-row--new' : ''}`}>
      <div className="cn-row-who">
        <b>{c.other.name.toUpperCase()}</b>
        <em>
          {c.other.role} · {c.other.location}
        </em>
      </div>
      <div className="cn-row-intent">
        <span>{i.emoji}</span>
        {c.state === 'matched' ? `BOTH WANT TO ${i.label}` : c.dir === 'in' ? `WANTS TO ${i.label}` : `YOU ASKED TO ${i.label}`}
        <small>{ago(c.decided_at ?? c.created_at)}</small>
      </div>
      {c.note && c.state === 'pending' && <q className="cn-note cn-row-note">{c.note}</q>}
      {needContact ? (
        <ContactForm cta="SAVE + ACCEPT ▸" onSaved={() => useConnect.getState().respond(c.id, true)} />
      ) : (
        <div className="cn-row-actions">
          {c.state === 'matched' && (
            <button className="pp-btn slant pp-btn--primary cn-btn" onClick={() => useConnect.getState().showMatch(c.id)}>
              <span className="unslant">{c.contact ? `${methodOf(c.contact.method).label} · TAKE IT FROM HERE ▸` : 'OPEN ▸'}</span>
            </button>
          )}
          {c.state === 'pending' && c.dir === 'in' && (
            <>
              <button
                className="pp-btn slant cn-btn"
                disabled={busy}
                onClick={async () => {
                  await useConnect.getState().respond(c.id, false)
                  useGame.getState().showToast('NOT NOW · THEY WON’T BE TOLD', 'info')
                }}
              >
                <span className="unslant">NOT NOW</span>
              </button>
              <button className="pp-btn slant pp-btn--primary cn-btn" disabled={busy} onClick={accept}>
                <span className="unslant">ACCEPT ▸</span>
              </button>
            </>
          )}
          {c.state === 'pending' && c.dir === 'out' && (
            <button className="gate-switch" onClick={() => useConnect.getState().withdraw(c.id)}>
              WITHDRAW
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const EMPTY: Record<Tab, string> = {
  requests: 'No requests yet. Set a status (N) to tell people what you’re up for.',
  matches: 'No matches yet. Find someone (F), open their profile and hit CONNECT.',
  sent: 'Nothing waiting. Requests nobody answers quietly disappear after 14 days.',
}

function YourContact() {
  const contact = useConnect((s) => s.contact)
  const setEmails = useConnect((s) => s.setEmails)
  const [edit, setEdit] = useState(false)
  if (edit) return <div className="cn-you"><ContactForm onSaved={() => setEdit(false)} /></div>
  if (!contact)
    return (
      <div className="cn-you">
        <span className="cr-label">HOW PEOPLE REACH YOU</span>
        <div className="cn-you-row">
          <span className="cn-fine">Not set yet. We’ll ask the first time you connect or accept.</span>
          <button className="gate-switch" onClick={() => setEdit(true)}>
            ADD ▸
          </button>
        </div>
      </div>
    )
  return (
    <div className="cn-you">
      <span className="cr-label">HOW PEOPLE REACH YOU</span>
      <div className="cn-you-row">
        <span>
          <b>{methodOf(contact.method).label}</b> {contactLabel(contact)}
        </span>
        <button className="gate-switch" onClick={() => setEdit(true)}>
          CHANGE
        </button>
      </div>
      <button className={`cr-toggle${contact.emails ? ' cr-toggle--on' : ''}`} onClick={() => setEmails(!contact.emails)}>
        <span className="cr-switch" />
        <span>
          <b>EMAIL ME</b>
          <em>When someone wants to connect, and when it’s a match</em>
        </span>
      </button>
    </div>
  )
}

/** C — the Connections screen. */
export function Connections() {
  const phase = useGame((s) => s.phase)
  const open = useGame((s) => s.connectOpen)
  const setOpen = useGame((s) => s.setConnectOpen)
  const member = useDirectory((s) => s.me?.status === 'approved')
  const items = useConnect((s) => s.items)
  const tab = useConnect((s) => s.tab)
  const setTab = useConnect((s) => s.setTab)
  const matchId = useConnect((s) => s.matchId)
  const showMatch = useConnect((s) => s.showMatch)

  const requests = items.filter((c) => c.state === 'pending' && c.dir === 'in')
  const matches = items.filter((c) => c.state === 'matched')
  const sent = items.filter((c) => c.state === 'pending' && c.dir === 'out')
  const lists: Record<Tab, Conn[]> = { requests, matches, sent }
  const match = matchId ? items.find((c) => c.id === matchId) : undefined

  const close = () => {
    setOpen(false)
    showMatch(null)
    requestLook()
  }

  // C = connections (members), from the street
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = useGame.getState()
      if (e.code !== 'KeyC' || e.repeat || isTyping(e) || g.phase !== 'play' || !isMemberNow()) return
      if (g.openId || g.searchOpen || g.paused || g.portalOpen || g.travel || g.statusOpen || g.invitesOpen) return
      e.preventDefault()
      g.setConnectOpen(!g.connectOpen)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // opening: land on what needs you, and mark it seen
  useEffect(() => {
    if (!open) return
    const s = useConnect.getState()
    if (!s.matchId) {
      const newMatch = s.items.some((c) => c.state === 'matched' && c.dir === 'out' && !c.seen)
      s.setTab(newMatch ? 'matches' : s.items.some((c) => c.state === 'pending' && c.dir === 'in') ? 'requests' : s.items.some((c) => c.state === 'matched') ? 'matches' : 'requests')
    }
    void s.load().then(() => useConnect.getState().markSeen())
  }, [open])

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
      if (useConnect.getState().matchId) showMatch(null)
      else close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  if (phase !== 'play' || !open || !member) return null

  return (
    <div className="cr cn">
      <div className="select-shade" />
      <div className="cr-panel cn-panel" key={match ? match.id : 'list'}>
        <div className="cr-top">
          <span className="cr-tag slant">
            <span className="unslant">CONNECTIONS</span>
          </span>
          <button className="pp-close st-close" onClick={close} aria-label="Close">
            <span className="keycap">ESC</span>
          </button>
        </div>

        {match ? (
          <Match c={match} onBack={() => showMatch(null)} />
        ) : (
          <>
            <h2 className="cr-title">WHO WANTS TO MEET</h2>
            <p className="cr-copy st-lede">Say yes and you both see how to reach each other. Say not now and they’re never told.</p>
            <div className="cn-tabs">
              {(['requests', 'matches', 'sent'] as Tab[]).map((t) => (
                <button key={t} className={`chip slant${tab === t ? ' chip--on' : ''}`} onClick={() => setTab(t)}>
                  <span className="unslant">
                    {t.toUpperCase()}
                    {lists[t].length > 0 && <em className="cn-count">{lists[t].length}</em>}
                  </span>
                </button>
              ))}
            </div>
            <div className="cn-list">
              {lists[tab].length ? lists[tab].map((c) => <Row key={c.id} c={c} />) : <p className="cn-empty">{EMPTY[tab]}</p>}
            </div>
            <YourContact />
          </>
        )}
      </div>
    </div>
  )
}
