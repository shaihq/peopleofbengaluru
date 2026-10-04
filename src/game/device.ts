// Device profile — decided once at load. Touch devices get touch controls,
// a phone layout and a lighter render profile (CLAUDE.md Phase 6B).

const hasWindow = typeof window !== 'undefined'

export const isTouch =
  hasWindow && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0)

/** Phones and small tablets — the lighter render profile. */
export const isPhone = hasWindow && isTouch && Math.min(window.innerWidth, window.innerHeight) < 820

export const quality = {
  dpr: (isPhone ? [1, 1.5] : [1, 1.75]) as [number, number],
  shadowMap: isPhone ? 2048 : 4096,
  ao: !isPhone,
  smaa: !isPhone,
}

if (hasWindow && isTouch) document.documentElement.classList.add('touch')
