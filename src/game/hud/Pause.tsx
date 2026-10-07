'use client'

import { useEffect, useState } from 'react'
import { useDirectory } from '../people/directory'
import { signOut, useOnboarding } from '../onboarding'
import { requestLook } from '../player/input'
import { useGame } from '../store'
import { useAudio } from '../audio/engine'
import { useAccess } from '../access'
import { useConnect } from '../connect'

const CONTROLS: [string[], string][] = [
  [['W', 'A', 'S', 'D'], 'MOVE'],
  [['SHIFT'], 'RUN'],
  [['MOUSE'], 'LOOK AROUND'],
  [['E'], 'TALK TO SOMEONE'],
  [['F'], 'FIND SOMEONE'],
  [['C'], 'CONNECTIONS'],
  [['V'], 'BECOME VISIBLE / EDIT PROFILE'],
  [['M'], 'MUTE SOUND'],
  [['ESC'], 'PAUSE'],
]

/** Esc while exploring. Opens from plain play only — profile, finder and creator keep their own Esc. */
export function Pause() {
  const phase = useGame((s) => s.phase)
  const paused = useGame((s) => s.paused)
  const setPaused = useGame((s) => s.setPaused)
  const startCreate = useGame((s) => s.startCreate)
  const showToast = useGame((s) => s.showToast)
  const me = useDirectory((s) => s.me)
  const signedIn = useDirectory((s) => !!s.userId)
  const [controls, setControls] = useState(false)
  const [sound, setSound] = useState(false)
  const [confirmOut, setConfirmOut] = useState(false)

  const resume = () => {
    setPaused(false)
    requestLook()
  }

  useEffect(() => {
    // When a popup (portal menu, finder, profile) closes, the browser may still report
    // the mouse-lock drop or a repeated Esc a moment later. Those belong to the popup
    // that just closed — they must not open Pause.
    let overlayClosedAt = -1e9
    const unsub = useGame.subscribe((s, p) => {
      const was = p.portalOpen || p.searchOpen || p.statusOpen || p.connectOpen || !!p.openId
      const now = s.portalOpen || s.searchOpen || s.statusOpen || s.connectOpen || !!s.openId
      if (was && !now) overlayClosedAt = performance.now()
    })
    const plain = () => {
      const g = useGame.getState()
      const cinematic = g.trackStage === 'fly' || g.trackStage === 'hold'
      return (
        g.phase === 'play' && !g.openId && !g.searchOpen && !g.statusOpen && !g.connectOpen && !g.paused && !cinematic && !g.portalOpen && !g.travel && performance.now() - overlayClosedAt > 700
      )
    }

    // Capture phase: we look at the state *before* the other Esc handlers close their own panels.
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape' || e.repeat) return
      const g = useGame.getState()
      if (g.paused) {
        // some browsers deliver the Esc that released the mouse as well — don't let it close us instantly
        if (performance.now() - g.pausedAt > 350) resume()
        return
      }
      if (plain()) g.setPaused(true)
    }
    // Most browsers swallow Esc while the mouse is captured and just drop the lock (also on alt-tab) → pause.
    const onLock = () => {
      if (!document.pointerLockElement && plain()) useGame.getState().setPaused(true)
    }

    window.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerlockchange', onLock)
    return () => {
      unsub()
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerlockchange', onLock)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!paused) {
      setControls(false)
      setSound(false)
      setConfirmOut(false)
    }
  }, [paused])

  if (phase !== 'play' || !paused) return null

  const profile = () => {
    setPaused(false)
    const ob = useOnboarding.getState()
    if (me) {
      ob.fromProfile()
      ob.setStep(1)
    } else ob.setStep(0)
    startCreate()
  }

  const signIn = () => {
    setPaused(false)
    useAccess.setState({ signinNext: true })
    startCreate()
  }

  const leave = async () => {
    if (!confirmOut) return setConfirmOut(true)
    await signOut()
    useAccess.setState({ status: 'ghost', reason: null, result: null })
    useConnect.getState().reset()
    setPaused(false)
    showToast('SIGNED OUT · YOU’RE INVISIBLE AGAIN', 'info')
    requestLook()
  }

  const status = me ? (me.status === 'approved' ? 'LIVE ON THE MAP' : me.status === 'hidden' ? 'HIDDEN' : 'PENDING APPROVAL') : 'INVISIBLE'

  return (
    <div className="pause" onMouseDown={(e) => e.target === e.currentTarget && resume()}>
      <div className="pause-card">
        <header className="pause-bar">
          <span className="pause-title">PAUSED</span>
          <span className="pause-who">
            {me ? (
              <>
                {me.name.toUpperCase()} <em>· {status}</em>
              </>
            ) : (
              <>
                GUEST <em>· {status}</em>
              </>
            )}
          </span>
        </header>

        <div className="pause-body">
          <button className="pause-row pause-row--primary" onClick={resume} autoFocus>
            <span className="pause-label">RESUME</span>
            <span className="keycap">ESC</span>
          </button>

          <button className="pause-row" onClick={profile}>
            <span className="pause-label">{me ? 'EDIT PROFILE' : 'BECOME VISIBLE'}</span>
            <span className="keycap">V</span>
          </button>

          {!signedIn && (
            <button className="pause-row" onClick={signIn}>
              <span className="pause-label">SIGN IN</span>
              <span className="pause-caret">MEMBERS + APPLICANTS</span>
            </button>
          )}

          <button className={`pause-row${sound ? ' pause-row--open' : ''}`} onClick={() => setSound((v) => !v)} aria-expanded={sound}>
            <span className="pause-label">SOUND</span>
            <span className="pause-caret">{sound ? '▴' : '▾'}</span>
          </button>
          {sound && <SoundSettings />}

          <button className={`pause-row${controls ? ' pause-row--open' : ''}`} onClick={() => setControls((c) => !c)} aria-expanded={controls}>
            <span className="pause-label">CONTROLS</span>
            <span className="pause-caret">{controls ? '▴' : '▾'}</span>
          </button>
          {controls && (
            <div className="pause-controls">
              {CONTROLS.map(([ks, what]) => (
                <div key={what} className="pause-ctl">
                  <span className="pause-keys">
                    {ks.map((k) => (
                      <span key={k} className={`keycap${k.length > 1 ? ' keycap--wide' : ''}`}>
                        {k}
                      </span>
                    ))}
                  </span>
                  <span>{what}</span>
                </div>
              ))}
            </div>
          )}

          {signedIn && (
            <button className={`pause-row pause-row--danger${confirmOut ? ' pause-row--confirm' : ''}`} onClick={leave}>
              <span className="pause-label">{confirmOut ? 'CLICK AGAIN TO CONFIRM' : 'SIGN OUT'}</span>
              {confirmOut && <span className="pause-caret">YOU’LL BE INVISIBLE AGAIN</span>}
            </button>
          )}
        </div>

        <footer className="pause-foot">
          <span className="keycap">ESC</span> BACK TO THE CITY
        </footer>
      </div>
    </div>
  )
}

function Slider({ label, k }: { label: string; k: 'master' | 'music' | 'sfx' }) {
  const v = useAudio((s) => s[k])
  const set = useAudio((s) => s.set)
  return (
    <label className="snd-row">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={v}
        onChange={(e) => set({ [k]: +e.target.value, muted: false })}
        style={{ ['--fill' as string]: `${v * 100}%` }}
        aria-label={label}
      />
      <b>{Math.round(v * 100)}</b>
    </label>
  )
}

function SoundSettings() {
  const muted = useAudio((s) => s.muted)
  const set = useAudio((s) => s.set)
  return (
    <div className="pause-controls snd">
      <Slider label="MASTER" k="master" />
      <Slider label="MUSIC" k="music" />
      <Slider label="EFFECTS & CITY" k="sfx" />
      <button className={`cr-toggle snd-mute${muted ? ' cr-toggle--on' : ''}`} onClick={() => set({ muted: !muted })}>
        <span className="cr-switch" />
        <span>
          <b>MUTE ALL</b>
          <em>Or press M any time</em>
        </span>
      </button>
    </div>
  )
}
