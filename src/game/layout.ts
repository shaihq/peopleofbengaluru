import { C } from '@/lib/palette'
import type { SignSpec } from './textures'

// Koramangala 5th Block — one hand-placed intersection (design.md §6.4).
// The N–S road runs along Z, the E–W "80 Feet Road" along X. Origin = junction.
//   NE: Namma Darshini + shop row     NW: Srinivasa Residency
//   SW: Peepal Labs (startup house)   SE: 5th Block Park + bus stop

export const ROAD = 5.25 // road half-width to kerb face
export const BASE = 0.15 // sidewalk / lot height
export { BOUNDS } from '@shared/net/config'
export const FH = 3.2 // floor height

export type AABB = { min: [number, number, number]; max: [number, number, number] }
export const colliders: AABB[] = []

function box(x0: number, x1: number, z0: number, z1: number, y0 = 0, y1 = 30) {
  colliders.push({
    min: [Math.min(x0, x1), y0, Math.min(z0, z1)],
    max: [Math.max(x0, x1), y1, Math.max(z0, z1)],
  })
}

function footprint(cx: number, cz: number, w: number, d: number, rot: number, y0 = 0, y1 = 30) {
  const swap = Math.abs(Math.sin(rot)) > 0.5
  const hx = (swap ? d : w) / 2
  const hz = (swap ? w : d) / 2
  box(cx - hx, cx + hx, cz - hz, cz + hz, y0, y1)
}

export const groundHeight = (x: number, z: number) => (Math.abs(x) < ROAD || Math.abs(z) < ROAD ? 0 : BASE)

// ---------------------------------------------------------------------------

export const CAFE = { x: 14.5, z: -12.5, rot: 0, w: 11, d: 9 }

export type ShopSpec = {
  x: number
  floors: number
  wall: string
  sign: SignSpec
  shutter: 'open' | 'half' | 'closed'
  goods: string[]
  balcony: boolean
  seed: number
}
export const SHOP_Z = -12
export const SHOPS: ShopSpec[] = [
  {
    x: 24,
    floors: 2,
    wall: C.WALL_POWDER,
    sign: { title: "IYENGAR'S BAKERY", kn: 'ಅಯ್ಯಂಗಾರ್ ಬೇಕರಿ', sub: 'HOT CHIPS · CAKES · PUFFS', bg: C.KERB_YELLOW, fg: C.SIGN_RED },
    shutter: 'open',
    goods: [C.WALL_BUTTER, '#C98A3A', C.WALL_PINK, C.WALL_WHITE],
    balcony: true,
    seed: 101,
  },
  {
    x: 30,
    floors: 2,
    wall: C.WALL_PINK,
    sign: { title: 'GANESH MEDICALS', kn: 'ಗಣೇಶ್ ಮೆಡಿಕಲ್ಸ್', sub: 'OPEN 24 HOURS', bg: C.AUTO_GREEN, fg: '#FFF6E5' },
    shutter: 'open',
    goods: [C.WALL_WHITE, C.WALL_POWDER, C.AUTO_GREEN, C.WALL_SALMON],
    balcony: false,
    seed: 102,
  },
  {
    x: 36,
    floors: 3,
    wall: C.WALL_MINT,
    sign: { title: 'SAI MOBILES', kn: 'ಸಾಯಿ ಮೊಬೈಲ್ಸ್', sub: 'RECHARGE · REPAIR · ACCESSORIES', bg: C.FLAME, fg: '#FFF6E5' },
    shutter: 'half',
    goods: [C.GRILLE, C.BMTC_BLUE, C.KERB_YELLOW, C.WALL_WHITE],
    balcony: true,
    seed: 103,
  },
  {
    x: 42,
    floors: 2,
    wall: C.WALL_BUTTER,
    sign: { title: 'NEW STAR TAILORS', kn: 'ನ್ಯೂ ಸ್ಟಾರ್ ಟೈಲರ್ಸ್', sub: 'LADIES & GENTS', bg: C.BMTC_BLUE, fg: '#FFF6E5' },
    shutter: 'closed',
    goods: [C.TERRACOTTA, C.WALL_POWDER, C.WALL_PINK, C.WALL_MINT],
    balcony: false,
    seed: 104,
  },
]

export type BuildingSpec = {
  x: number
  z: number
  rot: number
  w: number
  d: number
  floors: number
  wall: string
  trim?: string
  accent?: string
  stilt?: boolean
  balconies?: 'alt' | 'all' | 'none'
  tanks?: number
  mumty?: boolean
  seed: number
}

export const APARTMENT: BuildingSpec = {
  x: -16.5,
  z: -16,
  rot: 0,
  w: 14,
  d: 12,
  floors: 5,
  wall: C.WALL_BUTTER,
  trim: C.WALL_WHITE,
  accent: C.TERRACOTTA,
  stilt: true,
  balconies: 'alt',
  tanks: 3,
  seed: 7,
}

export const STARTUP = { x: -15, z: 15, rot: Math.PI }

export const PARK = { x0: 8.6, x1: 32, z0: 8.6, z1: 32, gate: [8.6, 12] as const }

export const BUS_STOP = { x: 24, z: 6.9, rot: Math.PI }

const H = Math.PI / 2
export const FILLERS: BuildingSpec[] = [
  { x: -14.5, z: -31, rot: H, w: 12, d: 11, floors: 3, wall: C.WALL_POWDER, accent: C.WALL_WHITE, seed: 3 },
  { x: 14.5, z: -31, rot: -H, w: 12, d: 11, floors: 4, wall: C.WALL_SALMON, stilt: true, seed: 4 },
  { x: 14.5, z: -46, rot: -H, w: 12, d: 11, floors: 3, wall: C.WALL_MINT, accent: C.WALL_BUTTER, seed: 5 },
  { x: -14.5, z: -46, rot: H, w: 12, d: 11, floors: 4, wall: C.WALL_PINK, accent: C.WALL_WHITE, seed: 6 },
  { x: -14.5, z: 30.5, rot: H, w: 12, d: 11, floors: 3, wall: C.WALL_SALMON, accent: C.WALL_WHITE, seed: 9 },
  { x: -31.5, z: -14, rot: 0, w: 12, d: 11, floors: 3, wall: C.WALL_MINT, accent: C.TERRACOTTA, seed: 10 },
  { x: -31.5, z: 14, rot: Math.PI, w: 12, d: 11, floors: 2, wall: C.WALL_POWDER, accent: C.WALL_WHITE, seed: 11 },
  { x: 38.5, z: 14, rot: Math.PI, w: 10, d: 10, floors: 3, wall: C.WALL_PINK, accent: C.WALL_WHITE, seed: 12, tanks: 1 },
]

export type TreeSpec = { x: number; z: number; s: number; seed: number; kind: 'rain' | 'gulmohar' }
export const TREES: TreeSpec[] = [
  { x: 20, z: 20, s: 1.35, seed: 11, kind: 'rain' },
  { x: -6.8, z: -33, s: 1.0, seed: 12, kind: 'rain' },
  { x: 6.8, z: 34, s: 1.05, seed: 13, kind: 'rain' },
  { x: 38, z: -6.8, s: 0.95, seed: 14, kind: 'rain' },
  { x: -34, z: 6.8, s: 1.0, seed: 15, kind: 'rain' },
  { x: 29, z: 12, s: 0.9, seed: 21, kind: 'gulmohar' },
  { x: -22.5, z: 10, s: 0.75, seed: 22, kind: 'gulmohar' },
]

// Electric poles: [x, z, armDirX, armDirZ] — lamp arm points over the road.
export const POLE_RUNS: [number, number, number, number][][] = [
  [-41, -27, -13].map((z) => [-7.3, z, 1, 0]),
  [-41, -27, -13].map((z) => [7.3, z, -1, 0]),
  [13, 27, 41].map((z) => [-7.3, z, 1, 0]),
  [13, 27].map((z) => [7.3, z, -1, 0]), // (no pole at 41 — keeps the portal plaza in clear view)
  [21, 33, 45].map((x) => [x, -7.3, 0, 1]),
  [-41, -27, -13].map((x) => [x, -7.3, 0, 1]),
  [13, 29, 43].map((x) => [x, 7.3, 0, -1]),
  [-41, -27, -13].map((x) => [x, 7.3, 0, -1]),
] as [number, number, number, number][][]

export const LANDMARKS = [
  { x: 24, z: 6.5, r: 3.5, label: 'BUS STOP' },
  { x: 0, z: 0, r: 5.5, label: '5TH BLOCK JUNCTION' },
  { x: 14.5, z: -9, r: 8, label: 'NAMMA DARSHINI' },
  { x: 34, z: -9, r: 12, label: '80 FEET ROAD' },
  { x: 20, z: 20, r: 13, label: '5TH BLOCK PARK' },
  { x: -15, z: 11, r: 9, label: 'PEEPAL LABS' },
  { x: -16, z: -11, r: 9, label: 'SRINIVASA RESIDENCY' },
]

// ---------------------------------------------------------------------------
// Colliders
// ---------------------------------------------------------------------------

// Darshini: kitchen block, side walls, mid pillar, counter, upper floor (camera only)
box(9, 20, -17, -11.5)
box(9, 9.4, -11.5, -8)
box(19.6, 20, -11.5, -8)
box(14.25, 14.75, -8.55, -8.05)
box(11.5, 17.5, -11.3, -10.5, 0, 1.2)
box(9, 20, -17, -8, 4.1, 9)
for (const x of [11, 14.5, 18]) box(x - 0.35, x + 0.35, -6.85, -6.15, 0, 1.2)

for (const s of SHOPS) {
  box(s.x - 3, s.x + 3, -16, -11) // back block
  box(s.x - 3, s.x - 2.4, -11, -8) // piers
  box(s.x + 2.4, s.x + 3, -11, -8)
  box(s.x - 2, s.x + 2, -9.1, -8.4, 0, 1.1) // counter
  box(s.x - 3, s.x + 3, -16, -8, 2.8, 14)
}

footprint(APARTMENT.x, APARTMENT.z, APARTMENT.w, APARTMENT.d, 0)
box(-24, -18.2, -8.55, -8.25, 0, 1.6) // compound wall, gate gap -18.2..-14.8
box(-14.8, -8.25, -8.55, -8.25, 0, 1.6)
box(-8.55, -8.25, -24, -8.25, 0, 1.6)

box(-20, -10, 13, 19) // startup house body
box(-20, -10, 11, 19, 3.2, 12) // porch roof (camera)
for (const x of [-18.8, -11.2]) box(x - 0.25, x + 0.25, 11, 11.5)
box(-24, -15.3, 8.25, 8.55, 0, 1.6) // compound wall, gate gap -15.3..-12.7
box(-12.7, -8.25, 8.25, 8.55, 0, 1.6)
box(-8.55, -8.25, 8.25, 24, 0, 1.6)

box(PARK.gate[1], PARK.x1, PARK.z0 - 0.15, PARK.z0 + 0.15, 0, 1.4)
box(PARK.x0 - 0.15, PARK.x0 + 0.15, PARK.z0 + 0.5, PARK.z1, 0, 1.4)
box(PARK.x0, PARK.x1, PARK.z1 - 0.15, PARK.z1 + 0.15, 0, 1.4)
box(PARK.x1 - 0.15, PARK.x1 + 0.15, PARK.z0, PARK.z1, 0, 1.4)
for (const [x, z, r] of [
  [16, 14.5, 0],
  [25, 20, 1],
  [16, 26, 0],
] as const)
  r ? box(x - 0.35, x + 0.35, z - 1.1, z + 1.1, 0, 0.8) : box(x - 1.1, x + 1.1, z - 0.35, z + 0.35, 0, 0.8)

box(21.8, 26.2, 7.2, 7.95, 0, 3) // bus stop back panel + bench
box(21.8, 26.2, 5.6, 7.95, 2.5, 3.2) // roof (camera)

for (const b of FILLERS) footprint(b.x, b.z, b.w, b.d, b.rot)

for (const t of TREES) box(t.x - 0.45 * t.s, t.x + 0.45 * t.s, t.z - 0.45 * t.s, t.z + 0.45 * t.s, 0, 4)

for (const run of POLE_RUNS) for (const [x, z] of run) box(x - 0.2, x + 0.2, z - 0.2, z + 0.2, 0, 9)

// ---------------------------------------------------------------------------
// Street life — hand-placed props (design.md §6.2). Every one has a reason.
// ---------------------------------------------------------------------------

export const COCONUT_CART = { x: 6.6, z: 18.2, rot: 0 }

export const SCOOTERS = [
  { x: -20.6, z: -12.4, rot: 0.15, color: C.WALL_POWDER }, // apartment stilt parking
  { x: -18.7, z: -12.7, rot: -0.1, color: C.SIGN_RED },
  { x: 29.6, z: -6.7, rot: Math.PI + 0.08, color: C.WALL_WHITE }, // outside Ganesh Medicals
  { x: 30.7, z: -6.6, rot: Math.PI - 0.06, color: C.RAIL_GREEN },
  { x: 40.2, z: -6.7, rot: Math.PI + 0.1, color: C.WALL_BUTTER },
  { x: -11.4, z: 6.9, rot: 0.12, color: C.FLAME }, // outside Peepal Labs
]

export const STREET_SIGNS = [
  {
    x: 6.4,
    z: -6.4,
    rot: -Math.PI / 4,
    spec: { title: '80 FEET ROAD', kn: '80 ಅಡಿ ರಸ್ತೆ', sub: 'KORAMANGALA 5TH BLOCK', bg: '#2F6B4F', fg: '#FFF6E5' },
  },
  {
    x: -6.4,
    z: 6.4,
    rot: (3 * Math.PI) / 4,
    spec: { title: '4TH MAIN ROAD', kn: '4ನೇ ಮುಖ್ಯ ರಸ್ತೆ', sub: 'KORAMANGALA 5TH BLOCK', bg: '#2F6B4F', fg: '#FFF6E5' },
  },
]

export const POSTERS = [
  { x: -12.6, z: -8.27, rot: 0, spec: { title: 'YOGA CLASSES', kn: 'ಯೋಗ ತರಗತಿ', sub: '6 AM · 5TH BLOCK PARK', bg: C.KERB_YELLOW, fg: '#1C1F2B' } },
  { x: -10.6, z: -8.27, rot: 0, spec: { title: 'DESIGN MEETUP', sub: 'SAT 11 AM · NAMMA DARSHINI', bg: '#1C1F2B', fg: '#FFB020' } },
  { x: -8.27, z: 16, rot: Math.PI / 2, spec: { title: 'MATHS TUITION', sub: 'STD 1–10 · STATE & CBSE', bg: C.WALL_POWDER, fg: '#1C1F2B' } },
  { x: -8.27, z: 19.4, rot: Math.PI / 2, spec: { title: '2BHK FOR RENT', sub: 'NO BACHELORS · CALL 98450 •••••', bg: C.WALL_WHITE, fg: C.SIGN_RED } },
]

export const RANGOLI = [
  { x: -14.4, z: 7.0, s: 1.3, seed: 1 },
  { x: -16.5, z: -7.0, s: 1.2, seed: 2 },
  { x: 42, z: -7.0, s: 1.1, seed: 3 },
]

export const MANHOLES: [number, number][] = [
  [-2, 26],
  [2.3, -14],
  [-15, -1.5],
  [30, 1.8],
  [-2.4, -36],
]

export const DUSTBIN = { x: -6.3, z: -6.7 }
export const CRATES = { x: 26.7, z: -7.6 }

box(COCONUT_CART.x - 0.65, COCONUT_CART.x + 0.65, COCONUT_CART.z - 1.0, COCONUT_CART.z + 1.5, 0, 2.6)
for (const s of SCOOTERS) box(s.x - 0.4, s.x + 0.4, s.z - 0.95, s.z + 0.95, 0, 1.2)
for (const s of STREET_SIGNS) box(s.x - 0.15, s.x + 0.15, s.z - 0.15, s.z + 0.15, 0, 3)
box(DUSTBIN.x - 0.35, DUSTBIN.x + 0.35, DUSTBIN.z - 0.35, DUSTBIN.z + 0.35, 0, 1)
box(CRATES.x - 0.3, CRATES.x + 0.3, CRATES.z - 0.25, CRATES.z + 0.25, 0, 1)
