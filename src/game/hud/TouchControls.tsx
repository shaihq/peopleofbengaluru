'use client'

import * as THREE from 'three'
import { useEffect, useRef, useState } from 'react'
import { isTouch } from '../device'
import { camRef, look, stick } from '../player/input'
import { bodies } from '../people/bodies'
import { useGame } from '../store'

const R = 56 // joystick radius (px)
const LOOK_X = 0.0065
const LOOK_Y = 0.0045

/**
 * Touch controls (CLAUDE.md Phase 6B):
 *  · left side: a joystick appears under your thumb (push to the rim = run)
 *  · right side: drag to look around, tap a person to talk to them
 *  · a pause button (there's no Esc on a phone)
 */
export function TouchControls() {
  const phase = useGame((s) => s.phase)
  const blocked = useGame((s) => !!s.openId || s.searchOpen || s.statusOpen || s.paused || s.portalOpen || !!s.travel)
  const [joy, setJoy] = useState<{ x: number; y: number; kx: number; ky: number; run: boolean } | null>(null)
  const joyId = useRef<number | null>(null)
  const lookTouch = useRef<{ id: number; x: number; y: number; sx: number; sy: number; t: number } | null>(null)
  const layer = useRef<HTMLDivElement>(null)

  const active = isTouch && phase === 'play' && !blocked
  const [portrait, setPortrait] = useState(false)
  const firstPlay = useRef(0)
  if (phase === 'play' && !firstPlay.current) firstPlay.current = performance.now()
  // eslint-disable-next-line react-hooks/purity
  const showTips = firstPlay.current > 0 && performance.now() - firstPlay.current < 7000
  useEffect(() => {
    const check = () => setPortrait(window.innerHeight > window.innerWidth)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // release everything when a menu opens
  useEffect(() => {
    if (active) return
    stick.x = stick.y = 0
    stick.run = false
    joyId.current = null
    lookTouch.current = null
    setJoy(null)
  }, [active])

  if (!isTouch || phase !== 'play') return null

  const tapPerson = (cx: number, cy: number) => {
    const cam = camRef.current
    if (!cam) return
    const v = new THREE.Vector3()
    let best: string | null = null
    let bestD = 80
    for (const [id, b] of bodies) {
      if (id === 'portal') continue
      if (cam.position.distanceTo(b) > 26) continue
      v.set(b.x, b.y + 1.2, b.z).project(cam)
      if (v.z > 1) continue
      const sx = ((v.x + 1) / 2) * window.innerWidth
      const sy = ((1 - v.y) / 2) * window.innerHeight
      const d = Math.hypot(sx - cx, sy - cy)
      if (d < bestD) {
        bestD = d
        best = id
      }
    }
    if (best) useGame.getState().openProfile(best)
  }

  const down = (e: React.PointerEvent) => {
    if (!active) return
    const left = e.clientX < window.innerWidth * 0.45
    if (left && joyId.current === null) {
      joyId.current = e.pointerId
      setJoy({ x: e.clientX, y: e.clientY, kx: 0, ky: 0, run: false })
    } else if (!left && !lookTouch.current) {
      lookTouch.current = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() }
    }
    layer.current?.setPointerCapture(e.pointerId)
  }

  const move = (e: React.PointerEvent) => {
    if (!active) return
    if (e.pointerId === joyId.current && joy) {
      const dx = e.clientX - joy.x
      const dy = e.clientY - joy.y
      const d = Math.hypot(dx, dy)
      const k = Math.min(1, d / R)
      const kx = d > 0 ? (dx / d) * k : 0
      const ky = d > 0 ? (dy / d) * k : 0
      stick.x = kx
      stick.y = -ky
      stick.run = d > R * 1.15
      setJoy({ ...joy, kx, ky, run: stick.run })
    } else if (lookTouch.current && e.pointerId === lookTouch.current.id) {
      const lt = lookTouch.current
      look.yaw -= (e.clientX - lt.x) * LOOK_X
      look.pitch = Math.min(0.8, Math.max(-0.2, look.pitch + (e.clientY - lt.y) * LOOK_Y))
      lt.x = e.clientX
      lt.y = e.clientY
    }
  }

  const up = (e: React.PointerEvent) => {
    if (e.pointerId === joyId.current) {
      joyId.current = null
      stick.x = stick.y = 0
      stick.run = false
      setJoy(null)
    } else if (lookTouch.current && e.pointerId === lookTouch.current.id) {
      const lt = lookTouch.current
      // a quick tap (not a drag) on someone = talk to them
      if (Math.hypot(e.clientX - lt.sx, e.clientY - lt.sy) < 12 && performance.now() - lt.t < 300) tapPerson(e.clientX, e.clientY)
      lookTouch.current = null
    }
  }

  return (
    <>
      <div ref={layer} className="touch-layer" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      {joy && (
        <div className={`joy${joy.run ? ' joy--run' : ''}`} style={{ left: joy.x, top: joy.y }}>
          <div className="joy-knob" style={{ transform: `translate(${joy.kx * R}px, ${joy.ky * R}px)` }} />
          {joy.run && <span className="joy-run">RUN</span>}
        </div>
      )}
      {!blocked && showTips && (
        <>
          {/* first-time hints; they fade on their own */}
          <span className="touch-tip touch-tip--l">LEFT THUMB · MOVE</span>
          <span className="touch-tip touch-tip--r">
            RIGHT THUMB · LOOK
            <br />
            TAP SOMEONE · TALK
          </span>
          {portrait && <span className="rotate-hint">↻ TURN SIDEWAYS FOR THE BEST VIEW</span>}
        </>
      )}
      {!blocked && (
        <button className="touch-pause slant" onClick={() => useGame.getState().setPaused(true)} aria-label="Pause">
          <span className="unslant touch-pause-bars" />
        </button>
      )}
    </>
  )
}
