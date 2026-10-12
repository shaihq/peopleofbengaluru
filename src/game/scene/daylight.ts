// TIME OF DAY (design.md §7.3): the city runs on Bengaluru's real clock. Each key below is a complete
// look (sun, sky, fog, ambient, reflections, how dark it is); between keys everything blends, so the
// light moves with the hour instead of switching. Plain data and functions: no three.js, no stores,
// tested in daylight.test.ts. (Relative imports only, so vitest runs it without a config.)

export type Look = {
  /** direction the sunlight (or moonlight) comes FROM, unnormalised */
  sunDir: [number, number, number]
  sun: string
  sunI: number
  /** hemisphere sky / ground bounce */
  sky: string
  ground: string
  hemiI: number
  /** cool back light that separates characters from the street (design.md §7.4) */
  rim: string
  rimI: number
  skyTop: string
  horizon: string
  /** the sun (or moon) disc and its glow in the sky */
  glow: string
  /** the sky as reflections and shadowed ground see it (softer than the painted sky after dark) */
  envTop: string
  fog: string
  clouds: string
  envI: number
  /** 0 day … 1 night: street lamps, lit windows, stars */
  night: number
}

const DAY: Look = {
  sunDir: [-0.55, 0.78, 0.42],
  sun: '#FFD9A0',
  sunI: 3.1,
  sky: '#A9CFF0',
  ground: '#C9A27A',
  hemiI: 1.15,
  rim: '#B8CFF2',
  rimI: 0.55,
  skyTop: '#5FA8E0',
  horizon: '#F4DDB4',
  glow: '#FFF1D6',
  envTop: '#5FA8E0',
  fog: '#F4DDB4',
  clouds: '#FFFFFF',
  envI: 0.6,
  night: 0,
}

const MORNING: Look = {
  sunDir: [0.62, 0.5, 0.6],
  sun: '#FFE2B8',
  sunI: 2.6,
  sky: '#BCD6EE',
  ground: '#D6B288',
  hemiI: 1.05,
  rim: '#C6D8F2',
  rimI: 0.5,
  skyTop: '#78B3E2',
  horizon: '#F7E3C8',
  glow: '#FFF3DE',
  envTop: '#86B5DE',
  fog: '#EFE1CC',
  clouds: '#FFF6EC',
  envI: 0.55,
  night: 0,
}

const GOLDEN: Look = {
  sunDir: [-0.82, 0.3, 0.5],
  sun: '#FFB46B',
  sunI: 2.8,
  sky: '#EBD3B4',
  ground: '#C98F64',
  hemiI: 1.25,
  rim: '#9FB8E0',
  rimI: 0.6,
  skyTop: '#6A9ED4',
  horizon: '#FFC98A',
  glow: '#FFE0B0',
  envTop: '#A3B4C6',
  fog: '#F2C792',
  clouds: '#FFDDB4',
  envI: 0.65,
  night: 0,
}

const DUSK: Look = {
  sunDir: [-0.86, 0.12, 0.5],
  sun: '#FF8E52',
  sunI: 1.5,
  sky: '#ABAEBF',
  ground: '#9A7C68',
  hemiI: 1.35,
  rim: '#9AB0DA',
  rimI: 0.55,
  skyTop: '#3F5F94',
  horizon: '#F0A274',
  glow: '#FFC7A0',
  envTop: '#8A90A6',
  fog: '#B88E80',
  clouds: '#F0B592',
  envI: 0.55,
  night: 0.6,
}

// A real city night, not a blue filter: a dark slate sky with the city's warm amber glow low on the
// horizon, near-neutral shadows, warm bounce off lit streets, and a dim, pale moon. The street lamps
// and windows carry the colour; the moon mostly edges rooftops and people.
const NIGHT: Look = {
  sunDir: [0.35, 0.8, 0.5],
  sun: '#BDC1C9',
  sunI: 1.0,
  sky: '#7D828D',
  ground: '#6B5C4F',
  hemiI: 2.0,
  rim: '#A7AEBC',
  rimI: 0.75,
  skyTop: '#131924',
  horizon: '#544840',
  glow: '#E2E6EC',
  envTop: '#474C58',
  fog: '#3B3734',
  clouds: '#423B3A',
  envI: 0.45,
  night: 1,
}

const DAWN: Look = {
  sunDir: [0.8, 0.12, 0.55],
  sun: '#FFB892',
  sunI: 1.3,
  sky: '#A9B3C9',
  ground: '#8E7A6E',
  hemiI: 1.3,
  rim: '#A9BEE2',
  rimI: 0.5,
  skyTop: '#4B70A4',
  horizon: '#F4BA96',
  glow: '#FFD6BC',
  envTop: '#8C94AA',
  fog: '#C7A89A',
  clouds: '#F4C8B0',
  envI: 0.55,
  night: 0.6,
}

/** [hour, look]. Bengaluru: sunrise ~6:10, sunset ~18:15, all year round within half an hour. */
export const KEYS: [number, Look][] = [
  [0, NIGHT],
  [5, NIGHT],
  [6, DAWN],
  [7.5, MORNING],
  [10, DAY],
  [15.5, DAY],
  [17.25, GOLDEN],
  [18.4, DUSK],
  [19.5, NIGHT],
  [24, NIGHT],
]

/** How far the city's own lights are on (lamps, lit windows): off by day, fading in through dusk. */
export const lightsOn = (night: number) => Math.min(1, Math.max(0, (night - 0.35) / 0.55))

export type Phase = 'night' | 'morning' | 'day' | 'evening'

/** What to call the hour (the HUD clock's icon). */
export function phaseAt(hour: number): Phase {
  const h = ((hour % 24) + 24) % 24
  if (h < 5.75 || h >= 19) return 'night'
  if (h < 10) return 'morning'
  if (h < 16.5) return 'day'
  return 'evening'
}

const hexRgb = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const rgbHex = (c: number[]) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const mixHex = (a: string, b: string, t: number) => {
  const x = hexRgb(a)
  const y = hexRgb(b)
  return rgbHex(x.map((v, i) => mix(v, y[i], t)))
}

/** The look at this hour (0–24, fractional), blended between its two keys. */
export function lookAt(hour: number): Look {
  const h = ((hour % 24) + 24) % 24
  let i = 0
  while (i < KEYS.length - 2 && KEYS[i + 1][0] <= h) i++
  const [h0, a] = KEYS[i]
  const [h1, b] = KEYS[i + 1]
  // smoothstep: the light eases in and out of each key instead of turning at it
  const lin = h1 > h0 ? (h - h0) / (h1 - h0) : 0
  const t = lin * lin * (3 - 2 * lin)
  const out = {} as Record<string, unknown>
  for (const k of Object.keys(a) as (keyof Look)[]) {
    const x = a[k]
    const y = b[k]
    if (typeof x === 'number') out[k] = mix(x, y as number, t)
    else if (typeof x === 'string') out[k] = mixHex(x, y as string, t)
    else out[k] = (x as number[]).map((v, j) => mix(v, (y as number[])[j], t))
  }
  return out as Look
}

/** Hours (0–24) on Bengaluru's clock (IST, UTC+5:30, no daylight saving), wherever the player is. */
export const bengaluruHour = (ms: number) => (((ms / 3_600_000 + 5.5) % 24) + 24) % 24

/** "?time=19:30" (or "19") → 19.5; anything else → null. */
export function parseTime(v: string | null): number | null {
  const m = v?.match(/^(\d{1,2})(?::(\d{2}))?$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2] ?? 0)
  return h < 24 && min < 60 ? h + min / 60 : null
}

/** 10.666 → "10:40 AM" */
export function clockText(hour: number): string {
  const total = Math.floor((((hour % 24) + 24) % 24) * 60 + 1e-6)
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
