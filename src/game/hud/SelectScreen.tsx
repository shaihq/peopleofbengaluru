'use client'

import { useEffect } from 'react'
import { ROSTER, getCharacter } from '../characters/roster'
import { requestLook } from '../player/input'
import { useGame } from '../store'

/** Character select — lobby-style, with the live street behind the hero (design.md §10). */
export function SelectScreen() {
  const phase = useGame((s) => s.phase)
  const characterId = useGame((s) => s.characterId)
  const setCharacter = useGame((s) => s.setCharacter)
  const enter = useGame((s) => s.enter)
  const def = getCharacter(characterId)
  const index = ROSTER.findIndex((c) => c.id === def.id)
  const active = phase === 'select'

  const step = (d: number) => setCharacter(ROSTER[(index + d + ROSTER.length) % ROSTER.length].id)
  const start = () => {
    enter()
    requestLook()
  }

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') step(-1)
      if (e.code === 'ArrowRight' || e.code === 'KeyD') step(1)
      if (e.code === 'Enter' || e.code === 'Space') start()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!active) return null

  return (
    <div className="select">
      <div className="select-shade" />

      <div className="select-head slant">
        <span className="unslant">CHOOSE YOUR CHARACTER</span>
      </div>

      <div className="select-info" key={def.id}>
        <div className="select-count">
          {String(index + 1).padStart(2, '0')} / {String(ROSTER.length).padStart(2, '0')}
        </div>
        <h2>{def.name}</h2>
        <p>{def.tagline}</p>
        <div className="select-arrows">
          <button className="arrow slant" onClick={() => step(-1)} aria-label="Previous character">
            <span className="unslant">◀</span>
          </button>
          <button className="arrow slant" onClick={() => step(1)} aria-label="Next character">
            <span className="unslant">▶</span>
          </button>
        </div>
      </div>

      <div className="select-roster">
        {ROSTER.map((c) => (
          <button
            key={c.id}
            className={`chip slant${c.id === def.id ? ' chip--on' : ''}`}
            onClick={() => setCharacter(c.id)}
            aria-label={c.name}
          >
            <span className="chip-swatch" style={{ background: c.accent }} />
            <span className="unslant chip-name">{c.name.replace('THE ', '')}</span>
          </button>
        ))}
      </div>

      <button className="btn-primary select-go slant" onClick={start}>
        <span className="unslant">START EXPLORING ▸</span>
      </button>
    </div>
  )
}
