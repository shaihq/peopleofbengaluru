'use client'

import { useEffect } from 'react'
import { useProgress } from '@react-three/drei'
import { useGame } from '../store'
import { useDirectory } from '../people/directory'
import { districtInfo, homeDistrict } from '../districts/registry'
import { requestLook } from '../player/input'
import { useAccess } from '../access'
import { useOnboarding } from '../onboarding'

/** Title screen over a slow cinematic orbit of the block. */
export function Intro() {
  const phase = useGame((s) => s.phase)
  const ready = useGame((s) => s.ready)
  const enter = useGame((s) => s.enter)
  const me = useDirectory((s) => s.me)
  const { progress } = useProgress()
  const pct = ready ? 100 : Math.min(99, Math.round(progress))
  // invite landing (?invite=CODE): check the code while the city loads, greet them with who vouched
  const linkCode = useAccess((s) => s.linkCode)
  const codeState = useAccess((s) => s.codeState)
  const inviter = useAccess((s) => s.inviter)
  const invited = !me && !!linkCode && codeState === 'ok' && !!inviter

  useEffect(() => {
    const a = useAccess.getState()
    if (!a.linkCode || useDirectory.getState().me) return
    useAccess.setState({ code: a.linkCode })
    void a.checkCode()
  }, [])

  const start = () => {
    if (!ready) return
    // signed-in players start in the district they live in
    if (me) useGame.getState().setDistrict(homeDistrict(me.location))
    enter()
    requestLook()
  }

  // straight into the gate, on the code step with the ✓ already showing
  const accept = () => {
    if (!ready) return
    enter()
    useOnboarding.getState().setStep(0)
    useGame.getState().startCreate()
  }

  return (
    <div className={`intro${phase !== 'intro' ? ' intro--gone' : ''}${ready ? ' intro--ready' : ''}`}>
      <div className="intro-shade" />
      <div className="intro-tag slant">
        <span className="unslant">EARLY ACCESS</span>
      </div>
      {invited ? (
        <div className="intro-title intro-title--invite">
          <div className="intro-kicker">YOU’RE INVITED</div>
          <h1>{inviter.name.split(' ')[0].toUpperCase()} INVITED YOU</h1>
          {inviter.role && <p className="intro-invite-role">{inviter.role}</p>}
          <p>Walk the city of designers and builders. When you’re ready, you go live — no review.</p>
        </div>
      ) : (
        <div className="intro-title">
          <div className="intro-kicker">DESIGNERS OF</div>
          <h1>BENGALURU</h1>
          <p>Walk the city. Meet the people who design it.</p>
          {!me && <p className="intro-note">You’ll arrive invisible — become visible whenever you’re ready.</p>}
        </div>
      )}
      <div className="intro-cta">
        {ready ? (
          invited ? (
            <>
              <button className="btn-primary slant" onClick={accept} autoFocus>
                <span className="unslant">ACCEPT INVITE ▸</span>
              </button>
              <button className="intro-later" onClick={start}>
                LOOK AROUND FIRST
              </button>
            </>
          ) : (
            <button className="btn-primary slant" onClick={start} autoFocus>
              <span className="unslant">{me ? `ENTER ${districtInfo(homeDistrict(me.location)).title} AS ${me.name.split(' ')[0].toUpperCase()} ▸` : 'ENTER KORAMANGALA ▸'}</span>
            </button>
          )
        ) : (
          <div className="loader slant">
            <div className="loader-fill" style={{ width: `${pct}%` }} />
            <span className="unslant loader-label">PAINTING THE CITY… {pct}%</span>
          </div>
        )}
      </div>
    </div>
  )
}
