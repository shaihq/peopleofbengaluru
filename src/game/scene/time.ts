import { create } from 'zustand'
import { bengaluruHour, lookAt, parseTime, type Look } from './daylight'

// The city's clock (design.md §7.3): Bengaluru's real time, so it's night in the game when it's night
// in the city. "?time=19:30" freezes the clock at that hour (for trying the looks and screenshots).

const fixed = typeof window === 'undefined' ? null : parseTime(new URLSearchParams(window.location.search).get('time'))

const hourNow = () => fixed ?? bengaluruHour(Date.now())

/**
 * The current look, read every frame by the lights, sky, fog and the night lights. Recomputed at most
 * once a second (the light moves with the hour; nothing needs it faster). `v` bumps when it changes,
 * so readers only touch their materials then.
 */
export const daylight: { hour: number; look: Look; v: number } = { hour: hourNow(), look: lookAt(hourNow()), v: 0 }
let last = 0

export function tickDaylight(now = performance.now()) {
  if (now - last < 1000) return daylight
  last = now
  const hour = hourNow()
  if (Math.abs(hour - daylight.hour) > 1e-4 || daylight.v === 0) {
    daylight.hour = hour
    daylight.look = lookAt(hour)
    daylight.v++
  }
  return daylight
}

/** The clock for the HUD, to the minute. */
export const useClock = create<{ hour: number }>(() => ({ hour: hourNow() }))

if (typeof window !== 'undefined') {
  setInterval(() => {
    const hour = hourNow()
    if (Math.floor(hour * 60) !== Math.floor(useClock.getState().hour * 60)) useClock.setState({ hour })
  }, 5000)
  if (process.env.NODE_ENV !== 'production') (window as unknown as { __daylight?: typeof daylight }).__daylight = daylight
}
