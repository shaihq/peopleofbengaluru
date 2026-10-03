'use client'

import { useEffect, useRef } from 'react'
import { bodies, player } from '../people/bodies'
import { PEOPLE } from '../people/profiles'
import { isTyping } from '../player/input'
import { useGame } from '../store'

/** Tracking banner — who you're heading to, how far, and how to take over. */
export function Tracker() {
  const trackId = useGame((s) => s.trackId)
  const stage = useGame((s) => s.trackStage)
  const stopTracking = useGame((s) => s.stopTracking)
  const dist = useRef<HTMLSpanElement>(null)
  const p = PEOPLE.find((x) => x.id === trackId)

  useEffect(() => {
    if (!trackId) return
    let raf = 0
    const loop = () => {
      const b = bodies.get(trackId)
      const me = player.pos
      if (b && me && dist.current) dist.current.textContent = `${Math.round(Math.hypot(b.x - me.x, b.z - me.z))}m`
      raf = requestAnimationFrame(loop)
    }
    loop()
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return
      if (e.code === 'KeyX') stopTracking()
      // skip the fly-over with any movement key
      const g = useGame.getState()
      if ((g.trackStage === 'fly' || g.trackStage === 'hold') && /^(Key[WASD]|Arrow|Space|Escape)/.test(e.code)) g.setTrackStage('walk')
    }
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
    }
  }, [trackId, stopTracking])

  if (!p) return null
  const found = stage === 'found'
  return (
    <div className={`tracker slant${found ? ' tracker--found' : ''}`} key={`${p.id}-${found}`}>
      <span className="unslant tracker-body">
        <span className="tracker-tag">{found ? 'FOUND' : stage === 'walk' ? 'HEADING TO' : 'LOCATING'}</span>
        <span className="tracker-name">{p.name}</span>
        {!found && <span className="tracker-dist" ref={dist} />}
        {!found && (
          <span className="tracker-hint">
            {stage === 'walk' ? (
              <>
                <span className="keycap keycap--wide">WASD</span> TAKE OVER · <span className="keycap">X</span> STOP
              </>
            ) : (
              <>
                <span className="keycap keycap--wide">WASD</span> SKIP
              </>
            )}
          </span>
        )}
      </span>
    </div>
  )
}
