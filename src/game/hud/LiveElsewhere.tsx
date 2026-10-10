'use client'

import { useEffect } from 'react'
import { useGame } from '../store'
import { useDirectory } from '../people/directory'
import { isTyping } from '../player/input'
import { takeOver } from '../net/client'
import { useNet } from '../net/useNet'

/**
 * LIVE CITY (CLAUDE.md Phase 8A): you're live in another tab or on another device, so this tab is paused —
 * nobody sees you from here. PLAY HERE (or H) makes this one live and pauses the other.
 */
export function LiveElsewhere() {
  const phase = useGame((s) => s.phase)
  const tracking = useGame((s) => !!s.trackId)
  const member = useDirectory((s) => s.me?.status === 'approved')
  const paused = useNet((s) => s.status === 'replaced')
  const show = phase === 'play' && member && paused

  // H = play here (the mouse is captured while you walk)
  useEffect(() => {
    if (!show) return
    const onKey = (e: KeyboardEvent) => {
      const g = useGame.getState()
      if (e.code !== 'KeyH' || e.repeat || isTyping(e) || g.openId || g.searchOpen || g.statusOpen || g.connectOpen || g.invitesOpen || g.paused) return
      e.preventDefault()
      takeOver()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show])

  // the tracking banner owns top-centre while you're heading to someone
  if (!show || tracking) return null
  return (
    <div className="ghostbar slant elsewhere" role="status">
      <span className="unslant ghostbar-inner">
        <span className="elsewhere-icon" aria-hidden>
          <i />
          <i />
        </span>
        <span className="ghostbar-text">
          <b>LIVE IN ANOTHER TAB</b>
          <span>Or on another device. Nobody sees you from this one.</span>
        </span>
        <button className="btn-primary slant ghostbar-cta" onClick={takeOver}>
          <span className="unslant">
            PLAY HERE <span className="keycap">H</span>
          </span>
        </button>
      </span>
    </div>
  )
}
