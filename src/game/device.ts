import { create } from 'zustand'

// Device profile + adaptive render quality (CLAUDE.md Phase 6B).
// Phones START at high quality; a frame-rate monitor steps down only if this
// particular phone can't keep up, and back up when it can.

const hasWindow = typeof window !== 'undefined'

export const isTouch =
  hasWindow && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0)

/** Phones and small tablets. */
export const isPhone = hasWindow && isTouch && Math.min(window.innerWidth, window.innerHeight) < 820
/** iPads and other large touch screens: mobile GPUs driving a lot of pixels. */
export const isTablet = isTouch && !isPhone

const deviceDpr = hasWindow ? window.devicePixelRatio || 1 : 1

/** 2 = high · 1 = medium · 0 = low */
export type Level = 0 | 1 | 2

// Touch devices (phones AND tablets) run mobile GPUs: no screen-space AO, and
// resolution is set by a PIXEL BUDGET, not a fixed ratio — a phone stays at a crisp
// 2x while an iPad's much bigger screen gets a ratio that costs about the same.
type Profile = { dpr: number; pixels: number; ao: 'medium' | 'performance' | null }
const PROFILE: Record<Level, Profile> = isTouch
  ? {
      2: { dpr: 2, pixels: 2.6e6, ao: null },
      1: { dpr: 1.75, pixels: 2.0e6, ao: null },
      0: { dpr: 1.5, pixels: 1.5e6, ao: null },
    }
  : {
      2: { dpr: 1.75, pixels: Infinity, ao: 'medium' },
      1: { dpr: 1.5, pixels: Infinity, ao: 'performance' },
      0: { dpr: 1.25, pixels: Infinity, ao: null },
    }

const params = hasWindow ? new URLSearchParams(window.location.search) : null
/** ?q=high|medium|low pins the quality level (adaptive stepping off). */
const pinned = ({ high: 2, medium: 1, low: 0 } as Record<string, Level>)[params?.get('q') ?? '']
export const qualityPinned = pinned !== undefined
/** Diagnostic URL switches, e.g. ?shadows=off|static, ?post=off|nobloom|nosmaa. */
export const flag = (k: string) => params?.get(k) ?? null

/** ?debug shows the live quality readout. */
export const showQualityDebug = !!params?.has('debug')

type QualityState = {
  level: Level
  fps: number
  /** Settled: no more switching this session (switching back and forth is what stutters). */
  locked: boolean
  /** Lowest level reached so far this session. */
  low: Level
  step: (d: 1 | -1) => void
  lock: () => void
  setFps: (f: number) => void
}

export const useQuality = create<QualityState>((set, get) => ({
  level: pinned ?? 2,
  fps: 0,
  locked: qualityPinned,
  low: pinned ?? 2,
  step: (d) => {
    if (get().locked) return
    const level = Math.max(0, Math.min(2, get().level + d)) as Level
    set({ level, low: Math.min(get().low, level) as Level })
  },
  // settle at the LOWEST level this device needed, not wherever the last flip landed
  lock: () => set({ locked: true, level: get().low }),
  setFps: (fps) => set({ fps }),
}))

export function profile(level: Level) {
  const p = PROFILE[level]
  const css = hasWindow ? window.innerWidth * window.innerHeight : 1
  const budget = Math.sqrt(p.pixels / css)
  return { dpr: Math.max(1, Math.min(deviceDpr, p.dpr, budget)), ao: p.ao }
}

/** Fixed per device (changing these at runtime would rebuild every shadow / pass). */
export const quality = {
  shadowMap: isTouch ? 2048 : 4096,
}

if (hasWindow && isTouch) document.documentElement.classList.add('touch')

/** ?debug: live switches, to measure what each stage costs on a real device. */
export type DebugToggles = { shadows: boolean; bloom: boolean }
export const useDebugToggles = create<DebugToggles & { toggle: (k: keyof DebugToggles) => void }>((set, get) => ({
  shadows: true,
  bloom: true,
  toggle: (k) => set({ [k]: !get()[k] } as Partial<DebugToggles>),
}))
