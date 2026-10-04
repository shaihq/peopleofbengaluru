import type { AABB } from '../layout'
import type { DistrictId } from './registry'

// The currently loaded district. Collision, routing, footsteps, landmarks and
// people all read from here, so only one district exists at a time.

export type Surface = 'asphalt' | 'pavers' | 'grass' | 'kota'
export type Pose = { x: number; z: number; face: number }
export type Spot = { label: string; blurb: string; slots: [number, number, number][] }

export type DistrictDef = {
  id: DistrictId
  colliders: AABB[]
  ground: (x: number, z: number) => number
  surface: (x: number, z: number) => Surface
  landmarks: { x: number; z: number; r: number; label: string }[]
  /** Fallback HUD sub-label when you're not near a landmark. */
  area: string
  /** Where you appear when you enter the game in this district. */
  spawn: Pose
  /** The portal ring (centre, facing) and where travellers step out of it. */
  portal: Pose
  arrival: Pose
  /** Spots people choose to hang out at (onboarding) — keyed by id. */
  spots: Record<string, Spot>
  /** Café-break spots for wandering residents. */
  breaks: Pose[]
  /** Positions birds sing from. */
  trees: { x: number; z: number }[]
  /** The radio the music leaks from while exploring (or none). */
  radio: [number, number, number] | null
  /** Camera orbit centre for the intro screen. */
  orbit: [number, number, number]
}

const registry = new Map<DistrictId, DistrictDef>()
export const registerDistrict = (d: DistrictDef) => registry.set(d.id, d)
export const getDistrict = (id: DistrictId) => registry.get(id)!

export const active = { def: null as unknown as DistrictDef }

const listeners = new Set<(d: DistrictDef) => void>()
export const onDistrictChange = (fn: (d: DistrictDef) => void) => (listeners.add(fn), () => listeners.delete(fn))

export function activateDistrict(id: DistrictId) {
  const d = registry.get(id)
  if (!d || active.def === d) return
  active.def = d
  listeners.forEach((fn) => fn(d))
}
