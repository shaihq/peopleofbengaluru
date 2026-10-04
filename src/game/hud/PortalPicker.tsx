'use client'

import { useEffect, useState } from 'react'
import { DISTRICTS, districtOfLocation } from '../districts/registry'
import { getPeople } from '../people/directory'
import { requestLook } from '../player/input'
import { useGame } from '../store'

/** Living here vs. waiting for their district to be built. */
function residents(id: string) {
  return getPeople().filter((p) => districtOfLocation(p.location).id === id).length
}

/** "WHERE TO?" — opens when you walk into a portal. */
export function PortalPicker() {
  const open = useGame((s) => s.portalOpen)
  const here = useGame((s) => s.district)
  const setOpen = useGame((s) => s.setPortalOpen)
  const startTravel = useGame((s) => s.startTravel)
  const choices = DISTRICTS.filter((d) => d.built && d.id !== here)
  const [sel, setSel] = useState(0)

  const close = () => {
    setOpen(false)
    requestLook()
  }
  const go = (id: (typeof DISTRICTS)[number]['id']) => startTravel(id)

  useEffect(() => {
    if (!open) return
    setSel(0)
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') return close()
      if (e.code === 'ArrowDown' || e.code === 'KeyS') setSel((s) => Math.min(choices.length - 1, s + 1))
      if (e.code === 'ArrowUp' || e.code === 'KeyW') setSel((s) => Math.max(0, s - 1))
      if (e.code === 'Enter' && choices[sel]) {
        e.preventDefault()
        go(choices[sel].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!open) return null
  return (
    <div className="find" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="find-card warp">
        <header className="find-bar">
          <span className="find-tag">
            <span className="warp-ring" /> WHERE TO?
          </span>
          <span className="find-count">PORTAL · ಪ್ರಯಾಣ</span>
          <button className="find-esc" onClick={close} aria-label="Close">
            <span className="keycap">ESC</span>
          </button>
        </header>
        <div className="find-body">
          <div className="find-results warp-list">
            {DISTRICTS.map((d) => {
              const isHere = d.id === here
              const idx = choices.findIndex((c) => c.id === d.id)
              const on = idx === sel && idx >= 0
              const n = residents(d.id)
              return (
                <button
                  key={d.id}
                  className={`find-row warp-row${on ? ' find-row--sel' : ''}${!d.built || isHere ? ' warp-row--off' : ''}`}
                  style={{ ['--accent' as string]: d.accent }}
                  disabled={!d.built || isHere}
                  onMouseEnter={() => idx >= 0 && setSel(idx)}
                  onClick={() => go(d.id)}
                >
                  <span className="find-who">
                    <span className="find-name">
                      {d.title} <span className="warp-kn">{d.kn}</span>
                    </span>
                    <span className="find-role">{d.identity}</span>
                  </span>
                  <span className="find-where">
                    {isHere ? (
                      <span className="find-place">YOU ARE HERE</span>
                    ) : d.built ? (
                      <>
                        <span className="find-place">{n} DESIGNER{n === 1 ? '' : 'S'}</span>
                        <span className="find-dir">LIVE HERE</span>
                      </>
                    ) : (
                      <>
                        <span className="find-place warp-soon">COMING SOON</span>
                        {n > 0 && <span className="find-dir">{n} waiting · visiting Koramangala</span>}
                      </>
                    )}
                  </span>
                  {d.built && !isHere && <span className="find-go">GO ▸</span>}
                </button>
              )
            })}
          </div>
        </div>
        <footer className="find-foot">
          <span>
            <span className="keycap">↑</span>
            <span className="keycap">↓</span> CHOOSE
          </span>
          <span>
            <span className="keycap keycap--wide">ENTER</span> TRAVEL
          </span>
          <span>
            <span className="keycap keycap--wide">ESC</span> STAY HERE
          </span>
        </footer>
      </div>
    </div>
  )
}
