import { BOUNDS } from './layout'
import { active } from './districts/active'

// Walkability grid + A* over the district, for "take me to them".

const CELL = 0.75
const HALF = BOUNDS
const N = Math.ceil((HALF * 2) / CELL)
const INFLATE = 0.45

const grids = new Map<string, Uint8Array>()

function build() {
  const g = new Uint8Array(N * N)
  for (const b of active.def.colliders) {
    if (b.min[1] > 1.6 || b.max[1] < 0.3) continue
    const i0 = Math.max(0, cell(b.min[0] - INFLATE))
    const i1 = Math.min(N - 1, cell(b.max[0] + INFLATE))
    const j0 = Math.max(0, cell(b.min[2] - INFLATE))
    const j1 = Math.min(N - 1, cell(b.max[2] + INFLATE))
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) g[j * N + i] = 1
  }
  return g
}

const cell = (v: number) => Math.floor((v + HALF) / CELL)
const center = (i: number) => -HALF + (i + 0.5) * CELL
const inside = (i: number, j: number) => i >= 0 && j >= 0 && i < N && j < N
const free = (g: Uint8Array, i: number, j: number) => inside(i, j) && g[j * N + i] === 0

function nearestFree(g: Uint8Array, i: number, j: number): [number, number] | null {
  if (free(g, i, j)) return [i, j]
  for (let r = 1; r < 8; r++)
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue
        if (free(g, i + di, j + dj)) return [i + di, j + dj]
      }
  return null
}

function lineOfSight(g: Uint8Array, ax: number, az: number, bx: number, bz: number) {
  const d = Math.hypot(bx - ax, bz - az)
  const steps = Math.ceil(d / (CELL * 0.4))
  for (let k = 1; k < steps; k++) {
    const t = k / steps
    if (!free(g, cell(ax + (bx - ax) * t), cell(az + (bz - az) * t))) return false
  }
  return true
}

/** Grid A* (8-way, no corner cutting) + line-of-sight smoothing. Returns world XZ waypoints. */
export function findPath(fx: number, fz: number, tx: number, tz: number): [number, number][] | null {
  let g = grids.get(active.def.id)
  if (!g) grids.set(active.def.id, (g = build()))
  const s = nearestFree(g, cell(fx), cell(fz))
  const e = nearestFree(g, cell(tx), cell(tz))
  if (!s || !e) return null
  const start = s[1] * N + s[0]
  const goal = e[1] * N + e[0]

  const gScore = new Float32Array(N * N).fill(Infinity)
  const came = new Int32Array(N * N).fill(-1)
  const closed = new Uint8Array(N * N)
  const heap: [number, number][] = [] // [f, idx]
  const push = (f: number, idx: number) => {
    heap.push([f, idx])
    let c = heap.length - 1
    while (c > 0) {
      const p = (c - 1) >> 1
      if (heap[p][0] <= heap[c][0]) break
      ;[heap[p], heap[c]] = [heap[c], heap[p]]
      c = p
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()!
    if (heap.length) {
      heap[0] = last
      let c = 0
      for (;;) {
        const l = c * 2 + 1
        const r = l + 1
        let m = c
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === c) break
        ;[heap[m], heap[c]] = [heap[c], heap[m]]
        c = m
      }
    }
    return top
  }
  const h = (idx: number) => {
    const dx = Math.abs((idx % N) - e[0])
    const dz = Math.abs(Math.floor(idx / N) - e[1])
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz)
  }

  gScore[start] = 0
  push(h(start), start)
  while (heap.length) {
    const [, cur] = pop()
    if (cur === goal) break
    if (closed[cur]) continue
    closed[cur] = 1
    const ci = cur % N
    const cj = Math.floor(cur / N)
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue
        const ni = ci + di
        const nj = cj + dj
        if (!free(g, ni, nj)) continue
        if (di && dj && (!free(g, ci + di, cj) || !free(g, ci, cj + dj))) continue
        const n = nj * N + ni
        const cost = gScore[cur] + (di && dj ? Math.SQRT2 : 1)
        if (cost < gScore[n]) {
          gScore[n] = cost
          came[n] = cur
          push(cost + h(n), n)
        }
      }
  }
  if (came[goal] === -1 && goal !== start) return null

  const raw: [number, number][] = []
  for (let c = goal; c !== -1; c = came[c]) raw.push([center(c % N), center(Math.floor(c / N))])
  raw.reverse()
  raw[0] = [fx, fz]

  // string-pull: keep only the corners we actually need
  const out: [number, number][] = [raw[0]]
  let a = 0
  while (a < raw.length - 1) {
    let b = raw.length - 1
    while (b > a + 1 && !lineOfSight(g, raw[a][0], raw[a][1], raw[b][0], raw[b][1])) b--
    out.push(raw[b])
    a = b
  }
  return out
}
