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
  const standalone =
    window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (standalone) return null
  // every iPhone browser (Chrome too) is WebKit: whatever the flags say, the page itself can't go full screen
  if (isIPhone()) return 'homescreen'
  const d = document as FsDoc
  return d.fullscreenEnabled || d.webkitFullscreenEnabled ? 'api' : null
}

const isIPhone = () => /iPhone|iPod/.test(navigator.userAgent)

/** Which browser the Add to Home Screen steps are for: Chrome's Share button sits in the address bar. */
export function iphoneBrowser(): 'chrome' | 'other' | 'safari' {
  const ua = navigator.userAgent
  if (/CriOS/.test(ua)) return 'chrome'
  if (/FxiOS|EdgiOS|OPiOS/.test(ua)) return 'other'
  return 'safari'
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
