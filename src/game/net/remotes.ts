import { EXTRAP_MS, INTERP_MS } from '@shared/net/config'
import { ANIMS, type Anim } from '@shared/net/protocol'

// Other members' live positions (CLAUDE.md Phase 8A), by member id. Snapshots are stamped with the time they
// arrived and drawn INTERP_MS in the past, so there are almost always two to blend between. Read every frame
// by <Person/>; React never sees these.

type Sample = { t: number; x: number; z: number; yaw: number; anim: Anim }
export type Remote = { samples: Sample[]; parked: boolean }
export type LivePose = { x: number; z: number; yaw: number; mode: (typeof ANIMS)[number]; parked: boolean }

const MAX_SAMPLES = 8

export const remotes = new Map<string, Remote>()

export function addRemote(id: string) {
  if (!remotes.has(id)) remotes.set(id, { samples: [], parked: false })
}

export function pushSample(id: string, x: number, z: number, yaw: number, anim: Anim, gone: boolean) {
  const r = remotes.get(id)
  if (!r) return
  if (gone) {
    r.parked = true
    return
  }
  r.parked = false
  r.samples.push({ t: performance.now(), x, z, yaw, anim })
  if (r.samples.length > MAX_SAMPLES) r.samples.shift()
}

const lerpAngle = (a: number, b: number, k: number) => {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * k
}

/** Where to draw them now; null until the first snapshot. */
export function poseOf(id: string, now = performance.now()): LivePose | null {
  const r = remotes.get(id)
  const s = r?.samples
  if (!r || !s?.length) return null
  const at = now - INTERP_MS
  let i = s.length - 1
  while (i > 0 && s[i - 1].t > at) i--
  const b = s[i]
  const a = i > 0 ? s[i - 1] : b
  let x: number, z: number, yaw: number
  if (at >= b.t) {
    // late snapshot: keep going the way they were going, briefly
    const ahead = Math.min(at - b.t, EXTRAP_MS)
    const span = b.t - a.t
    const vx = span > 0 && b.anim !== 0 ? (b.x - a.x) / span : 0
    const vz = span > 0 && b.anim !== 0 ? (b.z - a.z) / span : 0
    x = b.x + vx * ahead
    z = b.z + vz * ahead
    yaw = b.yaw
  } else {
    const k = b.t === a.t ? 1 : Math.max(0, Math.min(1, (at - a.t) / (b.t - a.t)))
    x = a.x + (b.x - a.x) * k
    z = a.z + (b.z - a.z) * k
    yaw = lerpAngle(a.yaw, b.yaw, k)
  }
  return { x, z, yaw, mode: ANIMS[b.anim], parked: r.parked }
}

export function clearRemotes() {
  remotes.clear()
}
