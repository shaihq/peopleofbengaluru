import { useGame } from '../store'
import { isTouch } from '../device'

// Keyboard + mouse-look state, read every frame by the player controller.

export const keys: Record<string, boolean> = {}

/** True when a key event belongs to a text field, so game keys must ignore it. */
export const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
}
export const look = { yaw: 0, pitch: 0.22, dragging: false }

/** Virtual joystick (touch): x = strafe, y = forward, both -1..1; run when pushed far. */
export const stick = { x: 0, y: 0, run: false }

/** The game camera (for touch hit-tests from the DOM layer). */
export const camRef = { current: null as import('three').Camera | null }

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

let installed = false

export function installInput() {
  if (installed) return () => {}
  installed = true

  const down = (e: KeyboardEvent) => {
    if (isTyping(e) || useGame.getState().paused) return
    keys[e.code] = true
  }
  const up = (e: KeyboardEvent) => {
    keys[e.code] = false
  }
  const blur = () => {
    for (const k in keys) keys[k] = false
    look.dragging = false
  }
  const move = (e: MouseEvent) => {
    const g = useGame.getState()
    if (g.phase !== 'play' || g.searchOpen || g.statusOpen || g.connectOpen || g.invitesOpen || g.openId || g.paused) return
    if (!document.pointerLockElement && !look.dragging) return
    look.yaw -= e.movementX * 0.0024
    look.pitch = clamp(look.pitch + e.movementY * 0.0018, -0.2, 0.8)
  }
  const release = () => {
    look.dragging = false
  }
  const lockChange = () => useGame.getState().setPointerLocked(!!document.pointerLockElement)

  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', blur)
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', release)
  document.addEventListener('pointerlockchange', lockChange)
  return () => {
    installed = false
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', blur)
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', release)
    document.removeEventListener('pointerlockchange', lockChange)
  }
}

/** Ask for pointer lock. `drag` = this came from pressing on the world, so drag-to-look works as a fallback. */
export function requestLook(drag = false) {
  if (isTouch) return // touch: the right thumb looks, there's no pointer to lock
  const g = useGame.getState()
  if (g.openId || g.searchOpen || g.statusOpen || g.connectOpen || g.invitesOpen || g.paused) return
  if (drag) look.dragging = true
  const canvas = document.querySelector<HTMLCanvasElement>('.game-root canvas')
  try {
    const p = canvas?.requestPointerLock() as unknown as Promise<void> | undefined
    p?.catch?.(() => {})
  } catch {
    // pointer lock unavailable — drag-to-look still works
  }
}
