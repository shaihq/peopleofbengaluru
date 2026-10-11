'use client'

import { useEffect } from 'react'
import { useGame } from '../store'
import { useDirectory } from '../people/directory'
import { keys } from '../player/input'
import { takeOver } from '../net/client'
import { useNet } from '../net/useNet'

/**
 * LIVE CITY (CLAUDE.md Phase 8A): you went live in another tab or on another device, so this tab was
 * disconnected. The game stops here behind one card: PLAY HERE (H or Enter) makes this one live again
 * and pauses the other; otherwise just close the tab.
 */
export function LiveElsewhere() {
  const phase = useGame((s) => s.phase)
  const member = useDirectory((s) => s.me?.status === 'approved')
  const paused = useNet((s) => s.status === 'replaced')
  const show = phase === 'play' && member && paused

  useEffect(() => {
    if (!show) return
    // let go of the mouse and stop walking: nothing in the game runs under this card
    if (document.pointerLockElement) document.exitPointerLock()
    for (const k in keys) keys[k] = false
    // the card owns the keyboard: H / Enter play here, every other game key is swallowed
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation()
      if (e.type !== 'keydown' || e.repeat) return
      if (e.code === 'KeyH' || e.code === 'Enter') {
        e.preventDefault()
        takeOver()
      }
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('keyup', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('keyup', onKey, true)
    }
  }, [show])

  if (!show) return null
  return (
    <div className="pause elsewhere-screen" role="alertdialog" aria-labelledby="elsewhere-title">
      <div className="pause-card">
        <header className="pause-bar">
          <span className="elsewhere-icon" aria-hidden>
            <i />
            <i />
          </span>
          <span className="pause-title" id="elsewhere-title">
            PLAYING ELSEWHERE
          </span>
        </header>
        <div className="pause-body">
          <p className="elsewhere-copy">
            You went live in another tab or on another device, so this one was disconnected. Close this tab, or play here instead.
          </p>
          <button className="pause-row pause-row--primary" onClick={takeOver} autoFocus>
            <span className="pause-label">PLAY HERE</span>
            <span className="keycap">H</span>
          </button>
        </div>
      </div>
    </div>
  )
}
