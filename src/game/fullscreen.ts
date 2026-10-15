'use client'

// Full screen (Phase 6B). Android, iPad and desktop browsers have the Fullscreen API. iPhone Safari
// doesn't (only videos), so there the city goes full screen as a Home Screen app instead
// (manifest display: fullscreen + apple-mobile-web-app-capable in layout.tsx).

type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitFullscreenEnabled?: boolean; webkitExitFullscreen?: () => Promise<void> }
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }

export type FullscreenMode = 'api' | 'homescreen' | null

/** 'api' = a button can toggle it; 'homescreen' = iPhone, explain Add to Home Screen; null = already there. */
export function fullscreenMode(): FullscreenMode {
  if (typeof document === 'undefined') return null
  const d = document as FsDoc
  if (d.fullscreenEnabled || d.webkitFullscreenEnabled) return 'api'
  const standalone =
    window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (standalone) return null
  return /iPhone|iPod/.test(navigator.userAgent) ? 'homescreen' : null
}

export function isFullscreen() {
  const d = document as FsDoc
  return !!(d.fullscreenElement || d.webkitFullscreenElement)
}

export async function toggleFullscreen() {
  const d = document as FsDoc
  try {
    if (isFullscreen()) {
      await (d.exitFullscreen ? d.exitFullscreen() : d.webkitExitFullscreen?.())
      return
    }
    const el = document.documentElement as FsEl
    await (el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen?.())
  } catch {
    // refused (no user gesture, or a browser policy): the game carries on as it was
  }
}
