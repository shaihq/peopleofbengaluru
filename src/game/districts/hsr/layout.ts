import { C } from '@/lib/palette'
import { BASE, type AABB, type BuildingSpec, type ShopSpec, type TreeSpec } from '../../layout'
import { portalColliders } from '../koramangala'

// HSR Layout, Sector 2 — the Builder / Indie district (CLAUDE.md Phase 6).
// Calmer and greener than Koramangala: a wide avenue (27th Main) with a planted
// median, a tree-lined sector road, co-working, specialty coffee, and a mural.
//
//   North (−Z): bungalows · sector road (19th Cross) · print shop row
//   27th Main runs along X — two carriageways + median
//   South (+Z): Brew Lab · Ship Club · PORTAL PLAZA · mural wall + Sector 2 park

export const MAIN = 8.5 // outer kerb of 27th Main (|z|)
export const MEDIAN = 1.2 // median half-width
export const MEDIAN_GAP = 6.5 // the junction opening in the median (|x|)
export const SIDE = 5.5 // sector road half-width (along Z, north only)

export const HSR_PORTAL = { x: 3, z: 19, face: Math.PI } // faces the avenue

export const BREW_LAB = { x: -34, z: 12.5, w: 12, d: 9 }
export const SHIP_CLUB = { x: -16, z: 13, w: 16, d: 12 }
export const MURAL = { x0: 14, x1: 41, z: 12.4, gate: [26, 29] as const }
export const SECTOR_PARK = { x0: 14, x1: 41, z0: 12.4, z1: 34 }

export const HSR_SHOPS: ShopSpec[] = [
  {
    x: 14,
    floors: 2,
    wall: C.WALL_MINT,
    sign: { title: 'XEROX & PRINTS', kn: 'ಜೆರಾಕ್ಸ್ ಮತ್ತು ಪ್ರಿಂಟ್ಸ್', sub: 'STICKERS · POSTERS · SPIRAL BINDING', bg: C.BMTC_BLUE, fg: '#FFF6E5' },
    shutter: 'open',
    goods: [C.WALL_WHITE, C.WALL_POWDER, C.KERB_YELLOW, C.WALL_PINK],
    balcony: true,
    seed: 201,
  },
  {
    x: 20,
    floors: 2,
    wall: C.WALL_BUTTER,
    sign: { title: 'MALNAD MESS', kn: 'ಮಲೆನಾಡು ಮೆಸ್', sub: 'MEALS · AKKI ROTTI · FILTER COFFEE', bg: C.SIGN_RED, fg: C.WALL_BUTTER },
    shutter: 'open',
    goods: [C.WALL_BUTTER, '#C98A3A', C.WALL_WHITE, C.AUTO_GREEN],
    balcony: false,
    seed: 202,
  },
  {
    x: 26,
    floors: 3,
    wall: C.WALL_POWDER,
    sign: { title: 'FRESH JUICE CORNER', kn: 'ತಾಜಾ ಜ್ಯೂಸ್', sub: 'SUGARCANE · MOSAMBI · WATERMELON', bg: C.AUTO_GREEN, fg: '#FFF6E5' },
    shutter: 'half',
    goods: [C.AUTO_GREEN, C.FLAME, C.KERB_YELLOW, C.WALL_PINK],
    balcony: true,
    seed: 203,
  },
]
export const HSR_SHOP_Z = -15

const H = Math.PI / 2
/** Independent houses — HSR's signature: two-storey homes behind gates. */
export const BUNGALOWS: (BuildingSpec & { gate: number })[] = [
  { x: -36, z: -18, rot: 0, w: 11, d: 9, floors: 2, wall: C.WALL_POWDER, accent: C.TERRACOTTA, tanks: 1, balconies: 'all', seed: 301, gate: -33 },
  { x: -21.5, z: -18, rot: 0, w: 11, d: 9, floors: 2, wall: C.WALL_PINK, accent: C.WALL_WHITE, tanks: 1, balconies: 'alt', seed: 302, gate: -18.5 },
  { x: -15, z: -32, rot: H, w: 10, d: 9, floors: 2, wall: C.WALL_BUTTER, accent: C.TERRACOTTA, tanks: 1, balconies: 'all', seed: 303, gate: -29 },
  { x: 36, z: -18, rot: 0, w: 11, d: 9, floors: 2, wall: C.WALL_MINT, accent: C.WALL_WHITE, tanks: 1, balconies: 'alt', seed: 304, gate: 38.5 },
]

/** Blocks that frame the streets — not hero buildings. */
export const HSR_FILLERS: BuildingSpec[] = [
  { x: 15, z: -32, rot: -H, w: 12, d: 11, floors: 4, wall: C.WALL_SALMON, stilt: true, seed: 311 },
  { x: -15, z: -45, rot: H, w: 10, d: 9, floors: 3, wall: C.WALL_MINT, accent: C.WALL_WHITE, seed: 312 },
  { x: 15, z: -45, rot: -H, w: 10, d: 9, floors: 3, wall: C.WALL_BUTTER, seed: 313 },
  { x: -34, z: 30, rot: Math.PI, w: 12, d: 11, floors: 3, wall: C.WALL_BUTTER, accent: C.TERRACOTTA, seed: 314 },
  { x: -16, z: 33, rot: Math.PI, w: 12, d: 10, floors: 4, wall: C.WALL_POWDER, stilt: true, seed: 315 },
  { x: 2, z: 36, rot: Math.PI, w: 12, d: 10, floors: 3, wall: C.WALL_SALMON, accent: C.WALL_WHITE, seed: 316 },
]

// Rain trees line the sector road and 27th Main; gulmohars in the median.
export const HSR_TREES: TreeSpec[] = [
  ...[-15, -25, -36, -44].flatMap((z, i) => [
    { x: -7.6, z, s: 1.05, seed: 401 + i, kind: 'rain' as const },
    { x: 7.6, z, s: 1.0, seed: 411 + i, kind: 'rain' as const },
  ]),
  // (none in front of the mural — it's meant to be seen)
  ...[-42, -28, 11, 44].map((x, i) => ({ x, z: 10, s: 0.95, seed: 421 + i, kind: 'rain' as const })),
  ...[-38, -24, -12, 12, 24, 38].map((x, i) => ({ x, z: 0, s: 0.62, seed: 431 + i, kind: 'gulmohar' as const })),
  { x: 22, z: 26, s: 1.3, seed: 441, kind: 'rain' },
  { x: 34, z: 20, s: 1.1, seed: 442, kind: 'rain' },
  { x: 33, z: 30, s: 0.85, seed: 443, kind: 'gulmohar' },
]

export function hsrGround(x: number, z: number) {
  if (Math.abs(z) < MEDIAN && Math.abs(x) > MEDIAN_GAP) return BASE + 0.05 // median planter
  if (Math.abs(z) < MAIN) return 0
  if (z < -MAIN && Math.abs(x) < SIDE) return 0
  return BASE
}

// --- colliders ---------------------------------------------------------------

export const hsrColliders: AABB[] = []
const box = (x0: number, x1: number, z0: number, z1: number, y0 = 0, y1 = 30) =>
  hsrColliders.push({ min: [Math.min(x0, x1), y0, Math.min(z0, z1)], max: [Math.max(x0, x1), y1, Math.max(z0, z1)] })
function footprint(cx: number, cz: number, w: number, d: number, rot: number) {
  const swap = Math.abs(Math.sin(rot)) > 0.5
  const hx = (swap ? d : w) / 2
  const hz = (swap ? w : d) / 2
  box(cx - hx, cx + hx, cz - hz, cz + hz)
}

// Brew Lab: building + the terrace tables
box(BREW_LAB.x - BREW_LAB.w / 2, BREW_LAB.x + BREW_LAB.w / 2, BREW_LAB.z, BREW_LAB.z + BREW_LAB.d)
for (const tx of [-38, -34, -30]) box(tx - 0.45, tx + 0.45, 10.2 - 0.45, 10.2 + 0.45, 0, 2.6)
// Ship Club: building + deck planters
box(SHIP_CLUB.x - SHIP_CLUB.w / 2, SHIP_CLUB.x + SHIP_CLUB.w / 2, SHIP_CLUB.z, SHIP_CLUB.z + SHIP_CLUB.d)
for (const px of [-22.5, -9.5]) box(px - 0.5, px + 0.5, 10.6, 11.6, 0, 1)
// mural wall (gate gap) + park railings
box(MURAL.x0, MURAL.gate[0], MURAL.z - 0.2, MURAL.z + 0.2, 0, 3)
box(MURAL.gate[1], MURAL.x1, MURAL.z - 0.2, MURAL.z + 0.2, 0, 3)
box(SECTOR_PARK.x0 - 0.15, SECTOR_PARK.x0 + 0.15, SECTOR_PARK.z0, SECTOR_PARK.z1, 0, 1.4)
box(SECTOR_PARK.x1 - 0.15, SECTOR_PARK.x1 + 0.15, SECTOR_PARK.z0, SECTOR_PARK.z1, 0, 1.4)
box(SECTOR_PARK.x0, SECTOR_PARK.x1, SECTOR_PARK.z1 - 0.15, SECTOR_PARK.z1 + 0.15, 0, 1.4)
for (const [x, z, r] of [
  [19, 18, 0],
  [36, 26, 1],
  [24, 31, 0],
] as const)
  r ? box(x - 0.35, x + 0.35, z - 1.1, z + 1.1, 0, 0.8) : box(x - 1.1, x + 1.1, z - 0.35, z + 0.35, 0, 0.8)
// shops
for (const s of HSR_SHOPS) {
  box(s.x - 3, s.x + 3, HSR_SHOP_Z - 4, HSR_SHOP_Z + 1)
  box(s.x - 3, s.x - 2.4, HSR_SHOP_Z + 1, HSR_SHOP_Z + 4)
  box(s.x + 2.4, s.x + 3, HSR_SHOP_Z + 1, HSR_SHOP_Z + 4)
  box(s.x - 2, s.x + 2, HSR_SHOP_Z + 2.9, HSR_SHOP_Z + 3.6, 0, 1.1)
  box(s.x - 3, s.x + 3, HSR_SHOP_Z - 4, HSR_SHOP_Z + 4, 2.8, 14)
}
// bungalows + their compound walls (gate gap 2.6m)
for (const b of BUNGALOWS) {
  footprint(b.x, b.z, b.w, b.d, b.rot)
  if (b.rot === 0) {
    const zf = b.z + b.d / 2 + 2.4
    box(b.x - b.w / 2 - 1, b.gate - 1.3, zf - 0.15, zf + 0.15, 0, 1.6)
    box(b.gate + 1.3, b.x + b.w / 2 + 1, zf - 0.15, zf + 0.15, 0, 1.6)
  } else {
    const xf = b.x + b.d / 2 + 2.4
    box(xf - 0.15, xf + 0.15, b.z - b.w / 2 - 1, b.gate - 1.3, 0, 1.6)
    box(xf - 0.15, xf + 0.15, b.gate + 1.3, b.z + b.w / 2 + 1, 0, 1.6)
  }
}
for (const b of HSR_FILLERS) footprint(b.x, b.z, b.w, b.d, b.rot)
for (const t of HSR_TREES) {
  const r = t.kind === 'gulmohar' ? 0.3 : 0.45 * t.s
  box(t.x - r, t.x + r, t.z - r, t.z + r, 0, 4)
}
// the median planter is a low step — walk over it anywhere outside the junction
hsrColliders.push(...portalColliders(HSR_PORTAL.x, HSR_PORTAL.z, HSR_PORTAL.face))
