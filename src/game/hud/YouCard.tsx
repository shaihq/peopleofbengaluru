'use client'

import { useEffect } from 'react'
import { useNet } from '../net/useNet'
import { useDirectory } from '../people/directory'
import { useOnboarding } from '../onboarding'
import { useAccess } from '../access'
import { activeStatus, untilLabel, useMyStatus } from '../status'
import { useCanSetStatus } from './StatusEditor'
import { useGame } from '../store'
import { isTyping } from '../player/input'

/** What the ghost bar says in each access state (CLAUDE.md Phase 5D). */
const GHOST_COPY = {
  ghost: { title: 'YOU’RE INVISIBLE', line: 'Nobody in the city can see you yet.', cta: 'BECOME VISIBLE' },
  applied: { title: 'ONE STEP LEFT', line: 'Pay the application fee to send it for review.', cta: 'FINISH APPLYING' },
  review: { title: 'UNDER REVIEW', line: 'You’re a ghost until a reviewer approves you.', cta: 'VIEW STATUS' },
  rejected: { title: 'NOT APPROVED', line: 'Fee refunded. A member can still invite you in.', cta: 'SEE DETAILS' },
  visible: { title: 'APPROVED', line: 'Open the link in your email to go live.', cta: 'VIEW' },
} as const

/** Bottom-right: the invisible guest's call to action, or your own status card. */
export function YouCard() {
  const phase = useGame((s) => s.phase)
  const busy = useGame((s) => !!s.openId || s.searchOpen || s.statusOpen || s.connectOpen || s.invitesOpen || s.paused)
  const tracking = useGame((s) => !!s.trackId)
  const netStatus = useNet((s) => s.status)
  const startCreate = useGame((s) => s.startCreate)
  const me = useDirectory((s) => s.me)
  const status = useAccess((s) => s.status)
  const myStatus = activeStatus(useMyStatus((s) => s.status))
  const canStatus = useCanSetStatus()
  const invited = useAccess((s) => !!s.linkCode)
  const signedIn = useDirectory((s) => !!s.userId)

  const become = () => {
    const ob = useOnboarding.getState()
    if (useDirectory.getState().me) {
      ob.fromProfile()
      ob.setStep(1)
    } else ob.setStep(0)
    startCreate()
  }

  // returning members and applicants: straight to the sign-in screen (same as the pause menu)
  const signIn = () => {
    useAccess.setState({ signinNext: true })
    startCreate()
  }

  // V = become visible / edit profile · L = sign in (not signed in only) — the mouse is captured while playing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = useGame.getState()
      if ((e.code !== 'KeyV' && e.code !== 'KeyL') || isTyping(e) || g.phase !== 'play' || g.openId || g.searchOpen || g.statusOpen || g.connectOpen || g.invitesOpen || g.paused) return
      if (e.code === 'KeyV') return become()
      if (!useDirectory.getState().userId && useAccess.getState().status === 'ghost') signIn()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (phase !== 'play' || busy) return null

  if (!me) {
    // the tracking banner owns top-centre while you're heading to someone
    if (tracking) return null
    return (
      <div className="ghostbar slant">
        <span className="unslant ghostbar-inner">
          <svg className="ghostbar-icon" viewBox="0 0 24 32" aria-hidden>
            <circle cx="12" cy="8" r="5.5" />
            <path d="M2.5 31v-7.5C2.5 18 6.8 15.5 12 15.5s9.5 2.5 9.5 8V31" />
          </svg>
          <span className="ghostbar-text">
            <b>{GHOST_COPY[status].title}</b>
            <span>{GHOST_COPY[status].line}</span>
          </span>
          <button className={`btn-primary slant ghostbar-cta${status === 'rejected' ? ' ghostbar-cta--quiet' : ''}`} onClick={become}>
            <span className="unslant">
              {status === 'ghost' && invited ? 'USE YOUR INVITE' : GHOST_COPY[status].cta} <span className="keycap">V</span>
            </span>
          </button>
          {!signedIn && status === 'ghost' && (
            <button className="btn-primary slant ghostbar-cta ghostbar-signin" onClick={signIn}>
              <span className="unslant">
                SIGN IN <span className="keycap">L</span>
              </span>
            </button>
          )}
        </span>
      </div>
    )
  }

  const live = me.status === 'approved'
  const elsewhere = live && netStatus === 'replaced'
  return (
    <div className="you slant">
      <span className="unslant you-body">
        <span className="you-k">YOU</span>
        <span className="you-name">{me.name.toUpperCase()}</span>
        <span className={`you-status${live && !elsewhere ? ' you-status--live' : ''}`}>
          <span className="np-dot" /> {elsewhere ? 'LIVE IN ANOTHER TAB' : live ? 'LIVE ON THE MAP' : me.status === 'hidden' ? 'HIDDEN' : 'PENDING APPROVAL'}
        </span>
        {canStatus && myStatus && (
          <span className="you-note">
            {myStatus.emoji && <span className="you-note-e">{myStatus.emoji}</span>}
            <span className="you-note-t">{myStatus.text}</span>
            {myStatus.expiresAt && <em>{untilLabel(myStatus.expiresAt)}</em>}
          </span>
        )}
        <span className="you-actions">
          {canStatus && (
            <button onClick={() => useGame.getState().setStatusOpen(true)}>
              {myStatus ? 'EDIT STATUS' : 'SET STATUS'} <span className="keycap">N</span>
            </button>
          )}
          {live && (
            <button onClick={() => useGame.getState().setInvitesOpen(true)}>
              INVITES <span className="keycap">I</span>
            </button>
          )}
          <button onClick={become}>
            EDIT PROFILE <span className="keycap">V</span>
          </button>
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
