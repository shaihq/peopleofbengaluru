'use client'

import * as THREE from 'three'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { audioCtx, loadSample, onReady, ready, setListener, setMuffle, unlock, useAudio } from './engine'
import { emitters, startAmbience } from './ambience'
import { radioEmitter, setMusicMode } from './music'
import { STEP_SAMPLES } from './footsteps'
import { sfx } from './sfx'
import { rayDistance } from '../player/collision'
import { bodies, player } from '../people/bodies'
import { isTyping } from '../player/input'
import { useGame } from '../store'

const CLICKABLE = 'button, a[href], [role="button"], .chip, .find-row, .cr-spot'

/** Wires the game's state to sound. Lives inside the Canvas (needs the camera). */
export function AudioDirector() {
  const camera = useThree((s) => s.camera)
  const fwd = useMemo(() => new THREE.Vector3(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  const occT = useRef(0)
  const pulseT = useRef(0)

  // --- unlock on the first gesture; then city + music --------------------------
  useEffect(() => {
    const go = () => unlock()
    window.addEventListener('pointerdown', go, true)
    window.addEventListener('keydown', go, true)
    onReady(() => {
      STEP_SAMPLES.forEach(loadSample)
      startAmbience()
      syncMusic()
    })
    return () => {
      window.removeEventListener('pointerdown', go, true)
      window.removeEventListener('keydown', go, true)
    }
  }, [])

  // --- game state → sound --------------------------------------------------------
  useEffect(() => {
    let prevFindCount = -1
    const unsub = useGame.subscribe((s, p) => {
      if (s.phase !== p.phase) syncMusic()
      if (s.phase === 'create' && p.phase !== 'create') sfx.step(0)
      const busy = s.paused || s.searchOpen || !!s.openId || s.phase === 'create'
      const wasBusy = p.paused || p.searchOpen || !!p.openId || p.phase === 'create'
      if (busy !== wasBusy) setMuffle(busy ? (s.paused ? 0.85 : 0.55) : 0)

      if (s.focusId && s.focusId !== p.focusId && !s.openId) sfx.prompt()
      if (s.openId && !p.openId) sfx.profileOpen()
      if (!s.openId && p.openId) sfx.profileClose()
      if (s.searchOpen && !p.searchOpen) {
        sfx.scanOpen()
        prevFindCount = -1
      }
      if (!s.searchOpen && p.searchOpen && !s.trackId) sfx.scanClose()
      if (s.paused && !p.paused) sfx.pauseOpen()
      if (!s.paused && p.paused) sfx.pauseClose()
      if (s.trackStage === 'fly' && p.trackStage !== 'fly') sfx.locate()
      if (s.trackStage === 'found' && p.trackStage !== 'found') sfx.found()
      if (s.toast && s.toast !== p.toast) (s.toast.msg.includes('VISIBLE') && s.toast.tone === 'good' ? sfx.goLive() : sfx.toast(s.toast.tone))
      if (s.landmark !== p.landmark && s.phase === 'play' && s.landmark !== '5TH BLOCK') sfx.landmark()
    })
    // results-count confirmation in the finder (debounced)
    let deb: ReturnType<typeof setTimeout> | null = null
    const onInput = (e: Event) => {
      if (!(e.target as HTMLElement).closest?.('.find')) return
      if (deb) clearTimeout(deb)
      deb = setTimeout(() => {
        const n = document.querySelectorAll('.find-row').length
        if (n !== prevFindCount) sfx.results(n)
        prevFindCount = n
      }, 260)
    }
    document.addEventListener('input', onInput)
    return () => {
      unsub()
      document.removeEventListener('input', onInput)
    }
  }, [])

  // --- UI: hover, press, click, typing, links, mute --------------------------------
  useEffect(() => {
    let hovered: Element | null = null
    const over = (e: PointerEvent) => {
      const el = (e.target as Element).closest?.(CLICKABLE)
      if (el && el !== hovered && !(el as HTMLButtonElement).disabled) sfx.hover()
      hovered = el ?? null
    }
    const down = (e: PointerEvent) => {
      const el = (e.target as Element).closest?.(CLICKABLE)
      if (el && !(el as HTMLButtonElement).disabled && !el.classList.contains('pp-btn--off')) sfx.press()
      else if (el?.classList.contains('pp-btn--off')) sfx.error()
    }
    const click = (e: MouseEvent) => {
      const el = (e.target as Element).closest?.(CLICKABLE)
      if (!el || (el as HTMLButtonElement).disabled) return
      if (el.matches('a[href^="http"]')) sfx.link()
      else if (el.matches('.chip, .cr-spot, .cr-toggle, .arrow, .find-row')) sfx.select()
      else if (el.matches('.cr-next')) sfx.step(+(document.querySelector('.cr-step')?.textContent?.match(/\d+/)?.[0] ?? 1))
      else if (el.matches('.cr-back')) sfx.back()
    }
    const key = (e: KeyboardEvent) => {
      if (isTyping(e)) {
        if (e.key.length === 1 || e.key === 'Backspace') sfx.typing()
        return
      }
      if (e.code === 'KeyM') useAudio.getState().set({ muted: !useAudio.getState().muted })
    }
    const errorWatch = new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) if ((n as Element).classList?.contains('cr-error')) sfx.error()
    })
    errorWatch.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('pointerover', over)
    document.addEventListener('pointerdown', down)
    document.addEventListener('click', click)
    window.addEventListener('keydown', key)
    return () => {
      errorWatch.disconnect()
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('click', click)
      window.removeEventListener('keydown', key)
    }
  }, [])

  // --- per frame: listener, occlusion, tracking pulses ------------------------------
  useFrame((_, dt) => {
    if (!ready()) return
    camera.getWorldDirection(fwd)
    setListener(camera.position.x, camera.position.y, camera.position.z, fwd.x, fwd.y, fwd.z)

    occT.current -= dt
    if (occT.current <= 0) {
      occT.current = 0.25
      const t = audioCtx()!.currentTime
      const radio = radioEmitter()
      for (const e of radio ? [...emitters, radio] : emitters) {
        dir.set(e.x - camera.position.x, e.y - camera.position.y, e.z - camera.position.z)
        const d = dir.length()
        dir.normalize()
        const blocked = d > 1 && rayDistance(camera.position, dir, d) < d - 1.2
        e.occl.frequency.setTargetAtTime(blocked ? 650 : 20000, t, 0.15)
      }
    }

    // "hear where they are": a pulse from the person you're heading to, faster as you close in
    const g = useGame.getState()
    const target = g.trackId && g.trackStage === 'walk' ? bodies.get(g.trackId) : undefined
    if (target && player.pos && !g.paused) {
      const d = Math.hypot(target.x - player.pos.x, target.z - player.pos.z)
      pulseT.current -= dt
      if (pulseT.current <= 0) {
        pulseT.current = THREE.MathUtils.clamp(d / 14, 0.35, 1.6)
        sfx.pulse(target.x, target.y, target.z, THREE.MathUtils.clamp(1 - d / 40, 0, 1))
      }
    } else pulseT.current = 0.4
  })

  return null
}

function syncMusic() {
  const { phase } = useGame.getState()
  setMusicMode(phase === 'intro' ? 'title' : phase === 'create' ? 'create' : 'explore')
}
