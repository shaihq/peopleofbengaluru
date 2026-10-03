import type * as THREE from 'three'
import { colliders } from '../layout'

/** Push a circle (the player) out of any static AABB it overlaps, in XZ. */
export function resolveCircle(pos: THREE.Vector3, r: number) {
  for (let pass = 0; pass < 2; pass++) {
    for (const b of colliders) {
      if (b.min[1] > pos.y + 1.6 || b.max[1] < pos.y + 0.3) continue
      const cx = Math.min(Math.max(pos.x, b.min[0]), b.max[0])
      const cz = Math.min(Math.max(pos.z, b.min[2]), b.max[2])
      const dx = pos.x - cx
      const dz = pos.z - cz
      const d2 = dx * dx + dz * dz
      if (d2 >= r * r) continue
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2)
        pos.x += (dx / d) * (r - d)
        pos.z += (dz / d) * (r - d)
      } else {
        const l = pos.x - b.min[0]
        const rr = b.max[0] - pos.x
        const n = pos.z - b.min[2]
        const s = b.max[2] - pos.z
        const m = Math.min(l, rr, n, s)
        if (m === l) pos.x = b.min[0] - r
        else if (m === rr) pos.x = b.max[0] + r
        else if (m === n) pos.z = b.min[2] - r
        else pos.z = b.max[2] + r
      }
    }
  }
}

/** Distance along a ray to the first static AABB, for camera collision. */
export function rayDistance(o: THREE.Vector3, d: THREE.Vector3, max: number) {
  let best = max
  for (const b of colliders) {
    let tmin = 0
    let tmax = best
    let hit = true
    for (let a = 0; a < 3; a++) {
      const oa = a === 0 ? o.x : a === 1 ? o.y : o.z
      const da = a === 0 ? d.x : a === 1 ? d.y : d.z
      if (Math.abs(da) < 1e-8) {
        if (oa < b.min[a] || oa > b.max[a]) {
          hit = false
          break
        }
      } else {
        let t1 = (b.min[a] - oa) / da
        let t2 = (b.max[a] - oa) / da
        if (t1 > t2) [t1, t2] = [t2, t1]
        tmin = Math.max(tmin, t1)
        tmax = Math.min(tmax, t2)
        if (tmin > tmax) {
          hit = false
          break
        }
      }
    }
    if (hit && tmin > 0.05 && tmin < best) best = tmin
  }
  return best
}
