export type Lod = 'near' | 'mid' | 'far' | 'off'

type Plate = { el: HTMLDivElement; d: number; want: Lod; x: number; y: number; behind: boolean; shown: Lod; tall?: boolean }

/** Per-frame nameplate requests, written by each <Person/>, resolved by declutter(). */
export const plates = new Map<string, Plate>()

// Approximate on-screen footprint (px) of a plate at each detail level.
const SIZE: Record<Exclude<Lod, 'off'>, [number, number]> = {
  near: [250, 86],
  mid: [210, 46],
  far: [130, 24],
}
/** Extra height a two-line status adds to the plate (Phase 5F). */
const STATUS_H: Record<Exclude<Lod, 'off'>, number> = { near: 18, mid: 0, far: 0 }
const DEMOTE: Record<Lod, Lod> = { near: 'far', mid: 'far', far: 'off', off: 'off' }

/**
 * Closest person keeps the richest plate; anyone further whose plate would
 * collide is demoted (to name-only, then hidden). Keeps crowds readable.
 */
export function declutter(width: number, height: number) {
  const list = [...plates.values()].sort((a, b) => a.d - b.d)
  const placed: [number, number, number, number][] = []
  for (const p of list) {
    let lod: Lod = p.behind ? 'off' : p.want
    const cx = ((p.x + 1) / 2) * width
    const cy = ((1 - p.y) / 2) * height
    while (lod !== 'off') {
      const [w, base] = SIZE[lod]
      const h = base + (p.tall ? STATUS_H[lod] : 0)
      const r: [number, number, number, number] = [cx - w / 2, cy - h, cx + w / 2, cy]
      const hit = placed.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])
      if (!hit) {
        placed.push(r)
        break
      }
      lod = DEMOTE[lod]
    }
    if (lod !== p.shown) {
      p.shown = lod
      p.el.dataset.lod = lod
    }
  }
}
