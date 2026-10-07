'use client'

import { useEffect, useRef, useState } from 'react'
import { useDirectory } from '../people/directory'
import { isTyping, requestLook } from '../player/input'
import { useGame } from '../store'
import { isTouch } from '../device'
import {
  CLEAR_OPTIONS,
  EMOJI_GRID,
  STATUS_MAX,
  SUGGESTIONS,
  activeStatus,
  expiryFor,
  firstEmoji,
  untilLabel,
  useMyStatus,
  type ClearAfter,
} from '../status'

/** `?statuspreview` lets anyone try the editor before 5F-B (UI only). */
const PREVIEW = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('statuspreview')

/** Only people others can see can set a status — a ghost's would show to nobody. */
export function useCanSetStatus() {
  const live = useDirectory((s) => s.me?.status === 'approved')
  return live || PREVIEW
}

/** "SET STATUS" — what you're up for, above your head (CLAUDE.md Phase 5F). */
export function StatusEditor() {
  const open = useGame((s) => s.statusOpen)
  const setOpen = useGame((s) => s.setStatusOpen)
  const saved = useMyStatus((s) => s.status)
  const save = useMyStatus((s) => s.save)
  const clear = useMyStatus((s) => s.clear)
  const setDraft = useMyStatus((s) => s.setDraft)
  const can = useCanSetStatus()

  const [text, setText] = useState('')
  const [emoji, setEmoji] = useState('')
  const [after, setAfter] = useState<ClearAfter>('never')
  const [custom, setCustom] = useState('')
  const [grid, setGrid] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  // N = set status (members only), from the street
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = useGame.getState()
      if (e.code !== 'KeyN' || e.repeat || isTyping(e) || g.phase !== 'play') return
      if (g.openId || g.searchOpen || g.paused || g.portalOpen || g.travel || g.statusOpen || !can) return
      e.preventDefault()
      g.setStatusOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [can])

  // opening: start from what you have now (or empty) — "don't clear" is the default
  useEffect(() => {
    if (!open) return
    const cur = activeStatus(useMyStatus.getState().status)
    setText(cur?.text ?? '')
    setEmoji(cur?.emoji ?? '')
    setAfter(cur?.expiresAt ? 'custom' : 'never')
    setCustom(cur?.expiresAt ? toLocalInput(cur.expiresAt) : '')
    setGrid(false)
    if (!isTouch) setTimeout(() => input.current?.focus(), 30)
  }, [open])

  // your bubble previews the edit live
  useEffect(() => {
    if (!open) return setDraft(null)
    setDraft({ text, emoji, expiresAt: null })
  }, [open, text, emoji, setDraft])

  const close = () => {
    setOpen(false)
    setDraft(null)
    requestLook()
  }
  const commit = async () => {
    if (!text.trim() && !emoji && !activeStatus(useMyStatus.getState().status)) return close()
    const setting = !!(text.trim() || emoji)
    close()
    const r = setting ? await save({ text, emoji, expiresAt: expiryFor(after, custom) }) : await clear()
    useGame
      .getState()
      .showToast(r.ok ? (setting ? 'STATUS SET' : 'STATUS CLEARED') : `COULDN’T SAVE YOUR STATUS — ${r.error?.toUpperCase()}`, r.ok ? 'good' : 'bad')
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (grid) setGrid(false)
        else close()
      }
      if (e.code === 'Enter' && !e.repeat && !(e.target as HTMLElement).closest('.st-actions, .st-grid, .st-custom')) {
        e.preventDefault()
        void commit()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  if (!open) return null
  const has = !!(text.trim() || emoji)
  const expiry = expiryFor(after, custom)
  const customBad = after === 'custom' && (expiry === null || expiry <= Date.now())

  return (
    <div className="cr st">
      <div className="select-shade" />
      <div className="cr-panel st-panel">
        <div className="cr-top">
          <span className="cr-tag slant">
            <span className="unslant">STATUS</span>
          </span>
          <button className="pp-close st-close" onClick={close} aria-label="Close">
            <span className="keycap">ESC</span>
          </button>
        </div>
        <h2 className="cr-title">WHAT’S YOUR STATUS?</h2>
        <p className="cr-copy st-lede">Shows above your head. Tell people what you’re up for — and give them something to say.</p>

        <div className="st-row">
          <button
            className={`st-emoji${emoji ? ' st-emoji--set' : ''}`}
            onClick={() => setGrid((g) => !g)}
            aria-label={emoji ? `Emoji ${emoji}, change` : 'Add an emoji'}
            aria-expanded={grid}
          >
            {emoji || <span className="st-emoji-add">☺</span>}
          </button>
          <label className="st-text">
            <input
              ref={input}
              value={text}
              maxLength={STATUS_MAX}
              placeholder="What are you up for?"
              spellCheck={false}
              onChange={(e) => setText(e.target.value)}
              aria-label="Status"
            />
            <span className={`st-count${text.length > STATUS_MAX - 15 ? ' st-count--near' : ''}`}>
              {text.length}/{STATUS_MAX}
            </span>
          </label>
        </div>

        {grid && (
          <div className="st-grid">
            {EMOJI_GRID.map((e) => (
              <button
                key={e}
                className={e === emoji ? 'on' : ''}
                onClick={() => {
                  setEmoji(e)
                  setGrid(false)
                  input.current?.focus()
                }}
              >
                {e}
              </button>
            ))}
            <label className="st-grid-any">
              <span>OR TYPE ANY EMOJI</span>
              <input
                value=""
                onChange={(ev) => {
                  const e = firstEmoji(ev.target.value)
                  if (e) {
                    setEmoji(e)
                    setGrid(false)
                  }
                }}
                aria-label="Type or paste an emoji"
              />
            </label>
            {emoji && (
              <button className="st-grid-none" onClick={() => setEmoji('')}>
                NO EMOJI
              </button>
            )}
          </div>
        )}

        <span className="cr-label st-label">SUGGESTIONS</span>
        <div className="st-sugs">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.text}
              className={`st-sug${s.text === text && s.emoji === emoji ? ' st-sug--on' : ''}`}
              onClick={() => {
                setText(s.text)
                setEmoji(s.emoji)
              }}
            >
              <span className="st-sug-e">{s.emoji}</span> {s.text}
            </button>
          ))}
        </div>

        <span className="cr-label st-label">CLEAR AFTER</span>
        <div className="cr-chips cr-chips--tight st-after">
          {CLEAR_OPTIONS.map((o) => (
            <button key={o.id} className={`chip slant${after === o.id ? ' chip--on' : ''}`} onClick={() => setAfter(o.id)}>
              <span className="unslant chip-name">{o.label}</span>
            </button>
          ))}
        </div>
        {after === 'custom' && (
          <label className="st-custom">
            <span className="cr-label">CLEAR ON</span>
            <input type="datetime-local" value={custom} min={toLocalInput(Date.now())} onChange={(e) => setCustom(e.target.value)} />
          </label>
        )}
        {has && !customBad && <p className="st-until">{expiry ? `Shows ${untilLabel(expiry)}.` : 'Stays until you change it.'}</p>}
        {has && customBad && <div className="cr-error">Pick a time in the future.</div>}

        <div className="cr-nav st-actions">
          {activeStatus(saved) ? (
            <button
              className="pp-btn slant cr-back"
              onClick={async () => {
                close()
                const r = await clear()
                useGame.getState().showToast(r.ok ? 'STATUS CLEARED' : `COULDN’T CLEAR YOUR STATUS — ${r.error?.toUpperCase()}`, r.ok ? 'info' : 'bad')
              }}
            >
              <span className="unslant">CLEAR STATUS</span>
            </button>
          ) : (
            <span />
          )}
          <button className="btn-primary slant cr-next" onClick={commit} disabled={has && customBad}>
            <span className="unslant">{has ? 'SAVE ▸' : 'DONE ▸'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/** ms → the value a datetime-local input expects, in local time. */
function toLocalInput(ms: number) {
  const d = new Date(ms - new Date().getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
}
