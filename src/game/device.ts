import { create } from 'zustand'

// Device profile + adaptive render quality (CLAUDE.md Phase 6B).
// Phones START at high quality; a frame-rate monitor steps down only if this
// particular phone can't keep up, and back up when it can.

const hasWindow = typeof window !== 'undefined'

export const isTouch =
  hasWindow && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0)

/** Phones and small tablets. */
export const isPhone = hasWindow && isTouch && Math.min(window.innerWidth, window.innerHeight) < 820

const deviceDpr = hasWindow ? window.devicePixelRatio || 1 : 1

/** 2 = high · 1 = medium · 0 = low */
export type Level = 0 | 1 | 2

// Sharpness matters more than effects on a small screen. Phones skip screen-space AO
// entirely (it renders black blotches on some mobile GPUs) and only step resolution.
const PROFILE: Record<Level, { dpr: number; ao: 'medium' | 'performance' | null }> = isPhone
  ? {
      2: { dpr: 2, ao: null },
      1: { dpr: 1.75, ao: null },
      0: { dpr: 1.5, ao: null },
    }
  : {
      2: { dpr: 1.75, ao: 'medium' },
      1: { dpr: 1.5, ao: 'performance' },
      0: { dpr: 1.25, ao: null },
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
  step: (d: 1 | -1) => void
  lock: () => void
  setFps: (f: number) => void
}

export const useQuality = create<QualityState>((set, get) => ({
  level: pinned ?? 2,
  fps: 0,
  locked: qualityPinned,
  step: (d) => {
    if (!get().locked) set({ level: Math.max(0, Math.min(2, get().level + d)) as Level })
  },
  lock: () => set({ locked: true }),
  setFps: (fps) => set({ fps }),
}))

export function profile(level: Level) {
  const p = PROFILE[level]
  return { dpr: Math.min(deviceDpr, p.dpr), ao: p.ao }
}

/** Fixed per device (changing these at runtime would rebuild every shadow / pass). */
export const quality = {
  shadowMap: isPhone ? 2048 : 4096,
}

if (hasWindow && isTouch) document.documentElement.classList.add('touch')

/** ?debug: live switches for each render stage, to find GPU-specific breakage on a real phone. */
export type DebugToggles = { shadows: boolean; bloom: boolean; tone: boolean; grade: boolean; vignette: boolean; clamp: boolean; mark: boolean }
export const useDebugToggles = create<DebugToggles & { toggle: (k: keyof DebugToggles) => void }>((set, get) => ({
  shadows: true,
  bloom: true,
  tone: true,
  grade: true,
  vignette: true,
  clamp: false,
  mark: false,
  toggle: (k) => set({ [k]: !get()[k] } as Partial<DebugToggles>),
}))
