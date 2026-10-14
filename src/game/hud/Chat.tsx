'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { intentOf } from '@/lib/intents'
import { useConnect, type Conn } from '../connect'
import { MSG_MAX, blockMember, loadOlder, openThread, reportMember, sendMessage, useChat, type Msg } from '../chat'
import { getPeople, useDirectory } from '../people/directory'
import { getCharacter } from '../characters/roster'
import { placeName } from '../districts/registry'
import { useGame } from '../store'
import { isTouch } from '../device'

// CHAT (CLAUDE.md Phase 5G) — one thread per match, inside the Connections panel.
// design.md §10: ink panel; your lines are saffron slabs, theirs ink-soft; condensed caps for labels.

const EMPTY: Msg[] = []

function clock(iso: string) {
  const d = new Date(iso)
  const today = new Date().toDateString() === d.toDateString()
  const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return today ? t : `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} · ${t}`
}

type Menu = null | 'menu' | 'block' | 'report' | 'unmatch'

/** Esc in an open thread closes its menu first (Connections asks before it steps back). */
let closeMenu: (() => boolean) | null = null
export const escInThread = () => closeMenu?.() ?? false

export function Thread({ c, onBack }: { c: Conn; onBack: () => void }) {
  const me = useDirectory((s) => s.me)
  const msgs = useChat((s) => s.threads[c.id] ?? EMPTY)
  const more = useChat((s) => !!s.more[c.id])
  const loaded = useChat((s) => c.id in s.threads)
  const failed = useChat((s) => !!s.failed[c.id])
  const [draft, setDraft] = useState('')
  const [menu, setMenu] = useState<Menu>(null)
  const [reason, setReason] = useState('')
  const [working, setWorking] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const stick = useRef(true)
  const olderFrom = useRef<number | null>(null)
  const i = intentOf(c.intent)
  const first = c.other.name.split(' ')[0]
  const there = getPeople().some((x) => x.id === c.other.id)
  const accent = getCharacter(c.other.character).accent
  const asker = c.dir === 'out' ? (me?.name ?? 'You') : c.other.name

  // stay at the bottom as messages arrive, unless you've scrolled up to read; keep your place when older ones load
  useLayoutEffect(() => {
    const el = list.current
    if (!el) return
    if (olderFrom.current !== null) {
      el.scrollTop = el.scrollHeight - olderFrom.current
      olderFrom.current = null
    } else if (stick.current) el.scrollTop = el.scrollHeight
  }, [msgs])

  useEffect(() => {
    if (!isTouch) input.current?.focus()
  }, [])

  useEffect(() => {
    closeMenu = () => {
      if (!menu) return false
      setMenu(menu === 'menu' ? null : 'menu')
      return true
    }
    return () => {
      closeMenu = null
    }
  }, [menu])

  const onScroll = () => {
    const el = list.current
    if (!el) return
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    if (el.scrollTop < 40 && more && olderFrom.current === null) {
      olderFrom.current = el.scrollHeight
      void loadOlder(c.id).then(() => {
        // nothing came back: let the next scroll try again
        if (olderFrom.current !== null && list.current?.scrollHeight === olderFrom.current) olderFrom.current = null
      })
    }
  }

  const send = () => {
    const body = draft.trim()
    if (!body) return
    stick.current = true
    setDraft('')
    void sendMessage(c.id, body)
  }

  const end = async (kind: 'block' | 'report' | 'unmatch') => {
    setWorking(true)
    const name = first.toUpperCase()
    if (kind === 'unmatch') {
      await useConnect.getState().remove(c.id)
      useGame.getState().showToast(`UNMATCHED · THE CHAT WITH ${name} IS GONE`, 'info')
    } else if (kind === 'block') {
      const ok = await blockMember(c.other.id)
      useGame
        .getState()
        .showToast(ok ? `${name} IS BLOCKED · NEITHER OF YOU CAN CONNECT AGAIN` : 'COULDN’T BLOCK · TRY AGAIN', ok ? 'info' : 'bad')
    } else {
      const ok = await reportMember(c.id, reason)
      useGame
        .getState()
        .showToast(ok ? `REPORTED + BLOCKED · THANKS, WE’LL LOOK AT IT` : 'COULDN’T REPORT · TRY AGAIN', ok ? 'info' : 'bad')
    }
    setWorking(false)
  }

  return (
    <div className="ch">
      <div className="ch-head">
        <button className="pp-btn slant ch-back" onClick={onBack} aria-label="All chats">
          <span className="unslant">◀</span>
        </button>
        <span className="cf-swatch" style={{ background: accent }} />
        <div className="ch-who">
          <b>{c.other.name.toUpperCase()}</b>
          <em>
            {c.other.role} · {placeName(c.other.location)}
          </em>
        </div>
        <button className={`ch-more${menu ? ' ch-more--on' : ''}`} onClick={() => setMenu(menu ? null : 'menu')} aria-label="More">
          •••
        </button>
      </div>

      {menu === 'menu' && (
        <div className="ch-menu">
          {there && (
            <button
              className="ch-menu-item"
              onClick={() => {
                useGame.getState().setConnectOpen(false)
                useGame.getState().track(c.other.id)
              }}
            >
              FIND {first.toUpperCase()} IN THE CITY ▸
            </button>
          )}
          <button className="ch-menu-item" onClick={() => setMenu('unmatch')}>
            UNMATCH
          </button>
          <button className="ch-menu-item ch-menu-item--bad" onClick={() => setMenu('block')}>
            BLOCK
          </button>
          <button className="ch-menu-item ch-menu-item--bad" onClick={() => setMenu('report')}>
            REPORT
          </button>
        </div>
      )}

      {(menu === 'unmatch' || menu === 'block' || menu === 'report') && (
        <div className="ch-confirm">
          <b>
            {menu === 'unmatch'
              ? `UNMATCH ${first.toUpperCase()}?`
              : menu === 'block'
                ? `BLOCK ${first.toUpperCase()}?`
                : `REPORT ${first.toUpperCase()}?`}
          </b>
          <p>
            {menu === 'unmatch'
              ? 'This chat is deleted for both of you. You can connect again later.'
              : menu === 'block'
                ? 'This chat is deleted for both of you, and neither of you can connect again. They aren’t told.'
                : 'We get a copy of this chat to review, then they’re blocked and the chat is deleted for both of you. They aren’t told who reported them.'}
          </p>
          {menu === 'report' && (
            <textarea
              className="cr-answer ch-reason"
              rows={2}
              maxLength={500}
              value={reason}
              placeholder="What happened? (optional)"
              onChange={(e) => setReason(e.target.value)}
              aria-label="What happened"
            />
          )}
          <div className="ch-confirm-row">
            <button className="pp-btn slant cn-btn" onClick={() => setMenu(null)} disabled={working}>
              <span className="unslant">CANCEL</span>
            </button>
            <button className="pp-btn slant cn-btn ch-danger" onClick={() => void end(menu)} disabled={working}>
              <span className="unslant">
                {working ? '…' : menu === 'unmatch' ? 'UNMATCH' : menu === 'block' ? 'BLOCK' : 'REPORT + BLOCK'}
              </span>
            </button>
          </div>
        </div>
      )}

      <div className="ch-list" ref={list} onScroll={onScroll}>
        {!more && (
          <div className="ch-start">
            <span className="ch-start-e">{i.emoji}</span>
            <span>
              <b>
                {asker.split(' ')[0].toUpperCase()} ASKED TO {i.label} · IT’S A MATCH
              </b>
              {c.note && <q className="cn-note">{c.note}</q>}
            </span>
          </div>
        )}
        {failed && !loaded && (
          <button className="ch-retry ch-load-failed" onClick={() => void openThread(c.id)}>
            COULDN’T LOAD THIS CHAT · RETRY
          </button>
        )}
        {loaded && msgs.length === 0 && <p className="ch-empty">Say hi. You both want to {i.verb} — suggest a time and a place.</p>}
        {msgs.map((m, n) => {
          const mine = m.sender_id === me?.id
          const prev = msgs[n - 1]
          const gap = !prev || prev.sender_id !== m.sender_id || Date.parse(m.created_at) - Date.parse(prev.created_at) > 5 * 60_000
          return (
            <div key={m.id} className={`ch-msg${mine ? ' ch-msg--me' : ''}${gap ? ' ch-msg--gap' : ''}`}>
              <div className={`ch-bubble${m.pending ? ' ch-bubble--pending' : ''}${m.failed ? ' ch-bubble--failed' : ''}`}>{m.body}</div>
              {m.failed ? (
                <button className="ch-retry" onClick={() => void sendMessage(c.id, m.body, m.id)}>
                  {m.failed} · RETRY
                </button>
              ) : (
                gap && <small className="ch-time">{m.pending ? 'SENDING…' : clock(m.created_at)}</small>
              )}
            </div>
          )
        })}
      </div>

      <div className="ch-compose">
        <textarea
          ref={input}
          className="cr-answer ch-input"
          rows={1}
          value={draft}
          maxLength={MSG_MAX}
          placeholder={`Message ${first}…`}
          enterKeyHint="send"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter is a new line (on a phone keyboard, the send key)
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              e.stopPropagation()
              send()
            }
          }}
          aria-label={`Message to ${first}`}
        />
        <button className="btn-primary slant ch-send" onClick={send} disabled={!draft.trim()} aria-label="Send">
          <span className="unslant">SEND</span>
        </button>
        {MSG_MAX - draft.length < 80 && <em className="ch-count">{MSG_MAX - draft.length}</em>}
      </div>
      <p className="cn-fine ch-fine">Only the two of you can read this. Unmatching deletes it for both.</p>
    </div>
  )
}
