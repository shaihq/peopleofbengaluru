import type * as THREE from 'three'

// Live positions of people in the district — used for player collision now,
// proximity + interaction in Phase 4.

export const bodies = new Map<string, THREE.Vector3>()

/** The player's live position, so people can turn to face you. */
export const player = { pos: null as THREE.Vector3 | null }

const BODY_R = 0.35

export function resolveBodies(pos: THREE.Vector3, r: number) {
  for (const b of bodies.values()) {
    const dx = pos.x - b.x
    const dz = pos.z - b.z
    const min = r + BODY_R
    const d2 = dx * dx + dz * dz
    if (d2 >= min * min || d2 < 1e-8) continue
    const d = Math.sqrt(d2)
    pos.x += (dx / d) * (min - d)
    pos.z += (dz / d) * (min - d)
  }
}
