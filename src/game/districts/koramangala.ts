import { colliders, groundHeight, LANDMARKS, PARK, ROAD, TREES, type AABB } from '../layout'
import { SPOTS } from '../people/spots'
import { registerDistrict, type Surface } from './active'

// Koramangala 5th Block — the first district (layout.ts holds the hand-placed scene).

export const KORA_PORTAL = { x: 14.5, z: 40.5, face: -Math.PI / 2 }
const PLINTH = 3.4

function surface(x: number, z: number): Surface {
  if (Math.abs(x) < ROAD || Math.abs(z) < ROAD) return 'asphalt'
  if (x > PARK.x0 && x < PARK.x1 && z > PARK.z0 && z < PARK.z1) {
    const loop = Math.abs(Math.max(Math.abs(x - 20), Math.abs(z - 20)) - 7) < 0.85
    return loop ? 'pavers' : 'grass'
  }
  if (z < -8 && z > -11.6 && x > 9 && x < 45) return 'kota'
  if (x > -20 && x < -10 && z > 10.9 && z < 13.1) return 'kota'
  if (Math.hypot(x - KORA_PORTAL.x, z - KORA_PORTAL.z) < PLINTH) return 'kota'
  return 'pavers'
}

/** The portal ring's two side pillars block; walk through the middle. */
export function portalColliders(px: number, pz: number, face: number): AABB[] {
  const ax = Math.abs(Math.sin(face)) > 0.5 // ring faces ±X → pillars spread along Z
  const out: AABB[] = []
  for (const s of [-1, 1]) {
    const cx = px + (ax ? 0 : s * 2.45)
    const cz = pz + (ax ? s * 2.45 : 0)
    out.push({ min: [cx - 0.5, 0, cz - 0.5], max: [cx + 0.5, 6, cz + 0.5] })
  }
  return out
}

registerDistrict({
  id: 'koramangala',
  colliders: [...colliders, ...portalColliders(KORA_PORTAL.x, KORA_PORTAL.z, KORA_PORTAL.face)],
  ground: (x, z) => groundHeight(x, z) + (Math.hypot(x - KORA_PORTAL.x, z - KORA_PORTAL.z) < PLINTH ? 0.1 : 0),
  surface,
  landmarks: [{ x: KORA_PORTAL.x, z: KORA_PORTAL.z, r: 6, label: 'PORTAL PLAZA' }, ...LANDMARKS],
  area: '5TH BLOCK',
  spawn: { x: 1.6, z: 21, face: Math.PI },
  portal: KORA_PORTAL,
  // far enough out that the follow camera sits in front of the portal, not inside it
  arrival: { x: KORA_PORTAL.x - 6.5, z: KORA_PORTAL.z, face: -Math.PI / 2 },
  spots: SPOTS,
  breaks: [
    ...[11, 14.5, 18].map((x) => ({ x, z: -5.85, face: Math.PI })),
    ...[...SPOTS.darshini.slots, ...SPOTS.coconut.slots].map(([x, z, face]) => ({ x, z, face })),
  ],
  trees: TREES.map((t) => ({ x: t.x, z: t.z })),
  radio: [14.5, 2.4, -10.5],
  orbit: [6, 3, -4],
})
