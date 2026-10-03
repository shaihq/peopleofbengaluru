import { create } from 'zustand'
import { DEFAULT_CHARACTER, ROSTER } from './characters/roster'

type Phase = 'intro' | 'select' | 'play'

const SAVED_KEY = 'dob.character'

function savedCharacter() {
  try {
    const id = localStorage.getItem(SAVED_KEY)
    if (id && ROSTER.some((c) => c.id === id)) return id
  } catch {
    // storage unavailable — fall back to default
  }
  return DEFAULT_CHARACTER
}

type GameState = {
  phase: Phase
  ready: boolean
  enteredAt: number
  landmark: string
  pointerLocked: boolean
  characterId: string
  /** Person you're close enough to talk to. */
  focusId: string | null
  /** Person whose profile panel is open. */
  openId: string | null
  searchOpen: boolean
  /** Person being located / walked to. */
  trackId: string | null
  trackStage: TrackStage
  trackT0: number
  setReady: () => void
  startSelect: () => void
  enter: () => void
  setLandmark: (l: string) => void
  setPointerLocked: (v: boolean) => void
  setCharacter: (id: string) => void
  setFocus: (id: string | null) => void
  openProfile: (id: string) => void
  closeProfile: () => void
  setSearch: (open: boolean) => void
  track: (id: string) => void
  setTrackStage: (stage: TrackStage) => void
  stopTracking: () => void
}

export type TrackStage = 'fly' | 'hold' | 'walk' | 'found' | null

export const useGame = create<GameState>((set) => ({
  phase: 'intro',
  ready: false,
  enteredAt: 0,
  landmark: '5TH BLOCK',
  pointerLocked: false,
  characterId: typeof window === 'undefined' ? DEFAULT_CHARACTER : savedCharacter(),
  focusId: null,
  openId: null,
  searchOpen: false,
  trackId: null,
  trackStage: null,
  trackT0: 0,
  setSearch: (searchOpen) => {
    if (searchOpen && document.pointerLockElement) document.exitPointerLock()
    set({ searchOpen })
  },
  track: (trackId) => set({ trackId, trackStage: 'fly', trackT0: performance.now(), searchOpen: false, openId: null }),
  setTrackStage: (trackStage) => set({ trackStage, trackT0: performance.now() }),
  stopTracking: () => set({ trackId: null, trackStage: null }),
  setReady: () => set({ ready: true }),
  setFocus: (focusId) => set({ focusId }),
  openProfile: (openId) => {
    if (document.pointerLockElement) document.exitPointerLock()
    set({ openId })
  },
  closeProfile: () => set({ openId: null }),
  startSelect: () => set({ phase: 'select' }),
  enter: () => set({ phase: 'play', enteredAt: performance.now() }),
  setLandmark: (landmark) => set({ landmark }),
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),
  setCharacter: (characterId) => {
    try {
      localStorage.setItem(SAVED_KEY, characterId)
    } catch {
      // non-critical
    }
    set({ characterId })
  },
}))
