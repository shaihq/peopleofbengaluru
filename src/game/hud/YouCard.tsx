'use client'

import { useEffect } from 'react'
import { useDirectory } from '../people/directory'
import { signOut, useOnboarding } from '../onboarding'
import { useGame } from '../store'
import { isTyping } from '../player/input'

/** Bottom-right: the invisible guest's call to action, or your own status card. */
export function YouCard() {
  const phase = useGame((s) => s.phase)
  const busy = useGame((s) => !!s.openId || s.searchOpen)
  const startCreate = useGame((s) => s.startCreate)
  const me = useDirectory((s) => s.me)

  const become = () => {
    const ob = useOnboarding.getState()
    if (useDirectory.getState().me) {
      ob.fromProfile()
      ob.setStep(1)
    } else ob.setStep(0)
    startCreate()
  }

  // V = become visible / edit profile (the mouse is captured while playing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = useGame.getState()
      if (e.code !== 'KeyV' || isTyping(e) || g.phase !== 'play' || g.openId || g.searchOpen) return
      become()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (phase !== 'play' || busy) return null

  if (!me)
    return (
      <div className="you you--guest slant">
        <span className="unslant you-body">
          <span className="you-k">YOU’RE INVISIBLE</span>
          <span className="you-v">Nobody can see you yet.</span>
          <button className="btn-primary slant you-cta" onClick={become}>
            <span className="unslant">
              BECOME VISIBLE <span className="keycap">V</span>
            </span>
          </button>
        </span>
      </div>
    )

  const live = me.status === 'approved'
  return (
    <div className="you slant">
      <span className="unslant you-body">
        <span className="you-k">YOU</span>
        <span className="you-name">{me.name.toUpperCase()}</span>
        <span className={`you-status${live ? ' you-status--live' : ''}`}>
          <span className="np-dot" /> {live ? 'LIVE ON THE MAP' : me.status === 'hidden' ? 'HIDDEN' : 'PENDING APPROVAL'}
        </span>
        <span className="you-actions">
          <button onClick={become}>
            EDIT PROFILE <span className="keycap">V</span>
          </button>
          <button onClick={() => signOut()}>SIGN OUT</button>
        </span>
      </span>
    </div>
  )
}

/** Short game-style confirmation toasts. */
export function Toast() {
  const toast = useGame((s) => s.toast)
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => useGame.setState({ toast: null }), 4200)
    return () => clearTimeout(id)
  }, [toast])
  if (!toast) return null
  return (
    <div className={`toast slant toast--${toast.tone}`} key={toast.id}>
      <span className="unslant">{toast.msg}</span>
    </div>
  )
}
