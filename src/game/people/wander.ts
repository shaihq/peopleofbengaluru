import { BOUNDS } from '../layout'
import { findPath } from '../nav'
import { active, type Pose } from '../districts/active'
import { districtOfLocation } from '../districts/registry'

// Offline characters: they keep walking around their neighbourhood.
// Nothing more — pick a walkable destination, walk there around buildings, repeat.

const WALK_MIN = 1.15
const WALK_MAX = 1.5
const TURN_RATE = 2.6 // rad/s — calm, natural turns
const VISITOR_RADIUS = 14

const FULL = { minX: -BOUNDS + 3, maxX: BOUNDS - 3, minZ: -BOUNDS + 3, maxZ: BOUNDS - 3 }

// Café break spots come from the loaded district (darshini tables, coconut cart, café fronts…).
type Break = Pose
const taken = new Set<Break>()

let budget = 0
/** Limits path searches per frame (called once per frame by <People/>). */
export const resetWanderBudget = () => (budget = 2)

const angleTo = (a: number, b: number) => {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

export class Wanderer {
  x: number
  z: number
  facing: number
  speed = 0
  private readonly area: { minX: number; maxX: number; minZ: number; maxZ: number }
  private readonly pace = WALK_MIN + Math.random() * (WALK_MAX - WALK_MIN)
  private readonly phase = Math.random() * 10
  private path: [number, number][] = []
  private idx = 0
  private stuckT = 0
  private lastX = 0
  private lastZ = 0
  /** Standing still: a short pause, or a longer café break. */
  private restT = 0
  private restFace: number | null = null
  private headingTo: Break | null = null
  private at: Break | null = null

  /**
   * People whose neighbourhood is built roam all of it. People from a
   * neighbourhood that isn't built yet stay around the spot they chose
   * (they never wander as if they lived somewhere else).
   */
  constructor(x: number, z: number, facing: number, neighbourhood: string) {
    this.x = this.lastX = x
    this.z = this.lastZ = z
    this.facing = facing
    // residents roam their whole district; visitors (district not built yet) stay near their spot
    const home = districtOfLocation(neighbourhood)
    this.area = home.built && home.id === active.def.id ? FULL : { minX: x - VISITOR_RADIUS, maxX: x + VISITOR_RADIUS, minZ: z - VISITOR_RADIUS, maxZ: z + VISITOR_RADIUS }
  }

  private pickDestination() {
    if (budget <= 0) return false
    budget--
    const a = this.area
    for (let tries = 0; tries < 6; tries++) {
      const tx = a.minX + Math.random() * (a.maxX - a.minX)
      const tz = a.minZ + Math.random() * (a.maxZ - a.minZ)
      const far = Math.hypot(tx - this.x, tz - this.z)
      if (far < 8 && tries < 5) continue // keep exploring — prefer somewhere a bit away
      const p = findPath(this.x, this.z, tx, tz)
      if (!p || p.length < 2) continue
      // the path ends on a walkable cell; make sure it's still inside our area
      const [ex, ez] = p[p.length - 1]
      if (ex < a.minX || ex > a.maxX || ez < a.minZ || ez > a.maxZ) continue
      this.path = p
      this.idx = 1
      return true
    }
    return false
  }

  private inArea(x: number, z: number) {
    const a = this.area
    return x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ
  }

  /** Reached the end of a walk: sometimes pause, sometimes head for a café break. */
  private arrived() {
    if (this.headingTo) {
      // at the café — stay a while
      this.at = this.headingTo
      this.headingTo = null
      this.restT = 15 + Math.random() * 25
      this.restFace = this.at.face
      return
    }
    const roll = Math.random()
    if (roll < 0.3) {
      const free = active.def.breaks.filter((b) => !taken.has(b) && this.inArea(b.x, b.z))
      const b = free[Math.floor(Math.random() * free.length)]
      if (b && budget > 0) {
        budget--
        const p = findPath(this.x, this.z, b.x, b.z)
        if (p) {
          p.push([b.x, b.z])
          this.path = p
          this.idx = 1
          this.headingTo = b
          taken.add(b)
          return
        }
      }
    }
    if (roll < 0.75) {
      this.restT = 3 + Math.random() * 6 // stop for a moment
      this.restFace = null
    }
  }

  update(dt: number) {
    // standing still
    if (this.restT > 0) {
      this.restT -= dt
      this.speed = Math.max(0, this.speed - dt * 3)
      if (this.restFace !== null) {
        const a = angleTo(this.facing, this.restFace)
        this.facing += Math.sign(a) * Math.min(Math.abs(a), TURN_RATE * dt)
      }
      if (this.restT <= 0 && this.at) {
        taken.delete(this.at)
        this.at = null
      }
      this.lastX = this.x
      this.lastZ = this.z
      this.stuckT = 0
      return
    }
    if (this.idx >= this.path.length) {
      if (this.path.length) {
        this.path = []
        this.arrived()
        return
      }
      if (!this.pickDestination()) {
        this.speed = Math.max(0, this.speed - dt * 2)
        return
      }
    }
    const [tx, tz] = this.path[this.idx]
    const dx = tx - this.x
    const dz = tz - this.z
    const d = Math.hypot(dx, dz)
    const last = this.idx === this.path.length - 1
    if (d < (last && this.headingTo ? 0.2 : 0.6)) {
      this.idx++
      return
    }
    // turn toward the next corner at a limited rate, with a slight wander in the heading
    const wobble = Math.sin(performance.now() / 1000 * 0.7 + this.phase) * 0.12
    const a = angleTo(this.facing, Math.atan2(dx, dz) + wobble)
    this.facing += Math.sign(a) * Math.min(Math.abs(a), TURN_RATE * dt)
    // ease off for sharp turns, otherwise stroll
    // and slow down smoothly into the end of a walk (no sudden stops)
    const ease = last ? Math.min(1, 0.3 + d / 1.5) : 1
    const want = this.pace * ease * Math.max(0.25, 1 - Math.max(0, Math.abs(a) - 0.4) / 1.2)
    this.speed += (want - this.speed) * Math.min(1, dt * 3)
    const step = Math.min(d, this.speed * dt)
    if (last && d < 1) {
      // final step: walk straight onto the spot (never circle around it)
      this.x += (dx / d) * step
      this.z += (dz / d) * step
    } else {
      this.x += Math.sin(this.facing) * step
      this.z += Math.cos(this.facing) * step
    }

    // never get stuck: no real progress for a few seconds → find a new way
    this.stuckT += dt
    if (this.stuckT > 3) {
      if (Math.hypot(this.x - this.lastX, this.z - this.lastZ) < 0.8) {
        this.path = []
        this.idx = 0
        if (this.headingTo) taken.delete(this.headingTo)
        this.headingTo = null
      }
      this.lastX = this.x
      this.lastZ = this.z
      this.stuckT = 0
    }
  }
}
