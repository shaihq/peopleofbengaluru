'use client'

import { useProgress } from '@react-three/drei'
import { useGame } from '../store'
import { useDirectory } from '../people/directory'
import { districtInfo, homeDistrict } from '../districts/registry'
import { requestLook } from '../player/input'

/** Title screen over a slow cinematic orbit of the block. */
export function Intro() {
  const phase = useGame((s) => s.phase)
  const ready = useGame((s) => s.ready)
  const enter = useGame((s) => s.enter)
  const me = useDirectory((s) => s.me)
  const { progress } = useProgress()
  const pct = ready ? 100 : Math.min(99, Math.round(progress))

  const start = () => {
    if (!ready) return
    // signed-in players start in the district they live in
    if (me) useGame.getState().setDistrict(homeDistrict(me.location))
    enter()
    requestLook()
  }

  return (
    <div className={`intro${phase !== 'intro' ? ' intro--gone' : ''}${ready ? ' intro--ready' : ''}`}>
      <div className="intro-shade" />
      <div className="intro-tag slant">
        <span className="unslant">EARLY ACCESS</span>
      </div>
      <div className="intro-title">
        <div className="intro-kicker">DESIGNERS OF</div>
        <h1>BENGALURU</h1>
        <p>Walk the city. Meet the people who design it.</p>
        {!me && <p className="intro-note">You’ll arrive invisible — become visible whenever you’re ready.</p>}
      </div>
      <div className="intro-cta">
        {ready ? (
          <button className="btn-primary slant" onClick={start} autoFocus>
            <span className="unslant">{me ? `ENTER ${districtInfo(homeDistrict(me.location)).title} AS ${me.name.split(' ')[0].toUpperCase()} ▸` : 'ENTER KORAMANGALA ▸'}</span>
          </button>
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
