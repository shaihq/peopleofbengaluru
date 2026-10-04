import { create } from 'zustand'

type Phase = 'intro' | 'create' | 'play'

export type TrackStage = 'fly' | 'hold' | 'walk' | 'found' | null

type Toast = { msg: string; tone: 'good' | 'info' | 'bad'; id: number } | null

type GameState = {
  phase: Phase
  ready: boolean
  enteredAt: number
  landmark: string
  pointerLocked: boolean
  /** Person you're close enough to talk to. */
  focusId: string | null
  /** Person whose profile panel is open. */
  openId: string | null
  searchOpen: boolean
  /** Pause menu (Esc while exploring). */
  paused: boolean
  pausedAt: number
  /** Person being located / walked to. */
  trackId: string | null
  trackStage: TrackStage
  trackT0: number
  toast: Toast
  setReady: () => void
  enter: () => void
  /** Open "become visible" (character creation + profile). */
  startCreate: () => void
  endCreate: () => void
  setLandmark: (l: string) => void
  setPointerLocked: (v: boolean) => void
  setFocus: (id: string | null) => void
  openProfile: (id: string) => void
  closeProfile: () => void
  setSearch: (open: boolean) => void
  setPaused: (paused: boolean) => void
  track: (id: string) => void
  setTrackStage: (stage: TrackStage) => void
  stopTracking: () => void
  showToast: (msg: string, tone?: 'good' | 'info' | 'bad') => void
}

const releaseMouse = () => {
  if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock()
}

export const useGame = create<GameState>((set) => ({
  phase: 'intro',
  ready: false,
  enteredAt: 0,
  landmark: '5TH BLOCK',
  pointerLocked: false,
  focusId: null,
  openId: null,
  searchOpen: false,
  paused: false,
  pausedAt: 0,
  trackId: null,
  trackStage: null,
  trackT0: 0,
  toast: null,
  setReady: () => set({ ready: true }),
  enter: () => set({ phase: 'play', enteredAt: performance.now() }),
  startCreate: () => {
    releaseMouse()
    set({ phase: 'create', openId: null, searchOpen: false, paused: false, focusId: null, trackId: null, trackStage: null })
  },
  endCreate: () => set({ phase: 'play', enteredAt: performance.now() }),
  setLandmark: (landmark) => set({ landmark }),
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),
  setFocus: (focusId) => set({ focusId }),
  openProfile: (openId) => {
    releaseMouse()
    set({ openId })
  },
  closeProfile: () => set({ openId: null }),
  setSearch: (searchOpen) => {
    if (searchOpen) releaseMouse()
    set({ searchOpen })
  },
  setPaused: (paused) => {
    if (paused) releaseMouse()
    set(paused ? { paused, pausedAt: performance.now() } : { paused })
  },
  track: (trackId) => set({ trackId, trackStage: 'fly', trackT0: performance.now(), searchOpen: false, openId: null }),
  setTrackStage: (trackStage) => set({ trackStage, trackT0: performance.now() }),
  stopTracking: () => set({ trackId: null, trackStage: null }),
  showToast: (msg, tone = 'info') => set({ toast: { msg, tone, id: Date.now() } }),
}))

if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  ;(window as unknown as { __game?: typeof useGame }).__game = useGame
}
