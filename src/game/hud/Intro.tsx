'use client'

import { useProgress } from '@react-three/drei'
import { useGame } from '../store'

/** Title screen over a slow cinematic orbit of the block. */
export function Intro() {
  const phase = useGame((s) => s.phase)
  const ready = useGame((s) => s.ready)
  const startSelect = useGame((s) => s.startSelect)
  const { progress } = useProgress()
  const pct = ready ? 100 : Math.min(99, Math.round(progress))

  const start = () => {
    if (!ready) return
    startSelect()
  }

  return (
    <div className={`intro${phase !== 'intro' ? ' intro--gone' : ''}${ready ? ' intro--ready' : ''}`}>
      <div className="intro-shade" />
      <div className="intro-tag slant">
        <span className="unslant">EARLY ACCESS · PHASE 5</span>
      </div>
      <div className="intro-title">
        <div className="intro-kicker">DESIGNERS OF</div>
        <h1>BENGALURU</h1>
        <p>Walk the city. Meet the people who design it.</p>
      </div>
      <div className="intro-cta">
        {ready ? (
          <button className="btn-primary slant" onClick={start} autoFocus>
            <span className="unslant">ENTER KORAMANGALA ▸</span>
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
