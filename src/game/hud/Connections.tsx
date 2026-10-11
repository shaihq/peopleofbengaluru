'use client'

import { useEffect, useState } from 'react'
import { INTENTS, intentOf, type Intent } from '@/lib/intents'
import { NOTE_MAX, SEND_ERRORS, connWith, groups, landingTab, unseenCount, useConnect, type Conn, type Tab } from '../connect'
import { openThread } from '../chat'
import { Thread, escInThread } from './Chat'
import type { Profile } from '../people/profiles'
import { useDirectory } from '../people/directory'
import { getCharacter } from '../characters/roster'
import { useOnboarding } from '../onboarding'
import { isTyping, requestLook } from '../player/input'
import { useGame } from '../store'
import { isTouch } from '../device'

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

  useEffect(() => {
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
        <button className="pp-btn slant pp-btn--primary cn-btn" onClick={() => void openThread(c.id)}>
          <span className="unslant">
            MESSAGE ▸{c.unread > 0 && <em className="hud-badge cn-unread">{c.unread}</em>}
          </span>
        </button>
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

/** A match in the list: who, the last line, unread. Opens the chat. */
function ChatRow({ c }: { c: Conn }) {
  const i = intentOf(c.intent)
  const fresh = c.unread > 0 || (c.dir === 'out' && !c.seen)
  return (
    <button className={`cn-row cn-chat-row${fresh ? ' cn-row--new' : ''}`} onClick={() => void openThread(c.id)}>
      <div className="cn-row-who">
        <b>{c.other.name.toUpperCase()}</b>
        <em>
          {c.other.role} · {c.other.location}
        </em>
      </div>
      <div className={`cn-chat-last${c.unread > 0 ? ' cn-chat-last--unread' : ''}`}>
        {c.last ? (
          <>
            {c.last.mine && <span className="cn-chat-you">YOU:</span>} {c.last.body}
          </>
        ) : (
          <>
            <span>{i.emoji}</span> BOTH WANT TO {i.label} · SAY HI
          </>
        )}
      </div>
      <span className="cn-chat-meta">
        {c.unread > 0 && <em className="hud-badge cn-unread">{c.unread}</em>}
        <small>{ago(c.last?.at ?? c.decided_at ?? c.created_at)}</small>
      </span>
    </button>
  )
}

function Row({ c }: { c: Conn }) {
  const busy = useConnect((s) => s.busy)
  const i = intentOf(c.intent)
  if (c.state === 'matched') return <ChatRow c={c} />
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
        {c.dir === 'in' ? `WANTS TO ${i.label}` : `YOU ASKED TO ${i.label}`}
        <small>{ago(c.created_at)}</small>
      </div>
      {c.note && <q className="cn-note cn-row-note">{c.note}</q>}
      <div className="cn-row-actions">
        {c.dir === 'in' && (
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
            <button className="pp-btn slant pp-btn--primary cn-btn" disabled={busy} onClick={() => useConnect.getState().respond(c.id, true)}>
              <span className="unslant">ACCEPT ▸</span>
            </button>
          </>
        )}
        {c.dir === 'out' && (
          <button className="gate-switch" onClick={() => useConnect.getState().withdraw(c.id)}>
            WITHDRAW
          </button>
        )}
      </div>
    </div>
  )
}

const EMPTY: Record<Tab, string> = {
  requests: 'No requests yet. Set a status (N) to tell people what you’re up for.',
  matches: 'No chats yet. Find someone (F), open their profile and hit CONNECT. When they say yes, your chat is here.',
  sent: 'Nothing waiting. Requests nobody answers quietly disappear after 14 days.',
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
  const threadId = useConnect((s) => s.threadId)
  const showThread = useConnect((s) => s.showThread)

  const lists = groups(items)
  const match = matchId ? items.find((c) => c.id === matchId) : undefined
  const thread = threadId ? items.find((c) => c.id === threadId && c.state === 'matched') : undefined

  const close = () => {
    setOpen(false)
    showMatch(null)
    showThread(null)
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
    if (!s.matchId && !s.threadId) s.setTab(landingTab(s.items))
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
      const st = useConnect.getState()
      if (st.threadId && escInThread()) return
      if (st.threadId) {
        showThread(null)
        st.setTab('matches')
      } else if (st.matchId) showMatch(null)
      else close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  if (phase !== 'play' || !open || !member) return null

  return (
    <div className="cr cn">
      <div className="select-shade" />
      <div className={`cr-panel cn-panel${thread ? ' cn-panel--chat' : ''}`} key={thread ? `t${thread.id}` : match ? match.id : 'list'}>
        <div className="cr-top">
          <span className="cr-tag slant">
            <span className="unslant">CONNECTIONS</span>
          </span>
          <button className="pp-close st-close" onClick={close} aria-label="Close">
            <span className="keycap">ESC</span>
          </button>
        </div>

        {thread ? (
          <Thread
            c={thread}
            onBack={() => {
              showThread(null)
              setTab('matches')
            }}
          />
        ) : match ? (
          <Match c={match} onBack={() => showMatch(null)} />
        ) : (
          <>
            <h2 className="cr-title">WHO WANTS TO MEET</h2>
            <p className="cr-copy st-lede">Say yes and a chat opens between you two. Say not now and they’re never told.</p>
            <div className="cn-tabs">
              {(['requests', 'matches', 'sent'] as Tab[]).map((t) => (
                <button key={t} className={`chip slant${tab === t ? ' chip--on' : ''}`} onClick={() => setTab(t)}>
                  <span className="unslant">
                    {t === 'matches' ? 'CHATS' : t.toUpperCase()}
                    {lists[t].length > 0 && <em className="cn-count">{lists[t].length}</em>}
                  </span>
                </button>
              ))}
            </div>
            <div className="cn-list">
              {lists[tab].length ? lists[tab].map((c) => <Row key={c.id} c={c} />) : <p className="cn-empty">{EMPTY[tab]}</p>}
            </div>
            <EmailSetting />
          </>
        )}
      </div>
    </div>
  )
}
