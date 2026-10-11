import type * as THREE from 'three'

// Live positions of people in the district — used for player collision now,
// proximity + interaction in Phase 4.

export const bodies = new Map<string, THREE.Vector3>()

/** The player's live position (so people can turn to face you) and pose (sent to the live city). */
export const player = { pos: null as THREE.Vector3 | null, facing: 0, anim: 'idle' as 'idle' | 'walk' | 'run' }

const BODY_R = 0.35

export function resolveBodies(pos: THREE.Vector3, r: number) {
  for (const [id, b] of bodies) {
    if (id === 'portal') continue // a travel target, not a person
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

if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  ;(window as unknown as { __bodies?: typeof bodies }).__bodies = bodies
}
