'use client'

import type { ReactElement } from 'react'
import { C } from '@/lib/palette'
import { BASE, FH, type BuildingSpec } from '../layout'
import { rng } from '../textures'
import { ACUnit, Balcony, Box, ClothesLine, Cyl, Dish, Door, Mumty, Parapet, Tank, Win } from './kit'

const CURTAINS = [C.TERRACOTTA, C.WALL_BUTTER, '#E9E4DA', C.WALL_POWDER, '#D9846B']
const CLOTHS = [C.FLAME, C.BMTC_BLUE, C.KERB_YELLOW, C.WALL_PINK, C.WALL_WHITE]

/**
 * A Bengaluru cement block: painted walls, white floor bands, chajja-shaded
 * windows, alternating balconies, parapet, water tanks and a stair-head room.
 * Local +Z is the street-facing front.
 */
export function Building({
  x,
  z,
  rot,
  w,
  d,
  floors,
  wall,
  trim = C.WALL_WHITE,
  accent = C.TERRACOTTA,
  stilt = false,
  balconies = 'alt',
  tanks = 2,
  mumty = true,
  seed,
}: BuildingSpec) {
  const H = floors * FH
  const y0 = stilt ? FH : 0
  const r = rng(seed)
  const curtain = () => (r() < 0.5 ? CURTAINS[Math.floor(r() * CURTAINS.length)] : null)
  const els: ReactElement[] = []
  let k = 0

  els.push(<Box key={k++} s={[w, H - y0, d]} p={[0, y0 + (H - y0) / 2, 0]} c={wall} />)

  for (let f = 1; f < floors; f++) {
    els.push(<Box key={k++} s={[w + 0.24, 0.22, d + 0.24]} p={[0, f * FH, 0]} c={trim} />)
  }

  if (stilt) {
    const nx = Math.max(2, Math.round(w / 4.5) + 1)
    for (let i = 0; i < nx; i++) {
      const px = -w / 2 + 0.3 + (i * (w - 0.6)) / (nx - 1)
      for (const pz of [d / 2 - 0.3, -d / 2 + 0.3]) {
        els.push(<Box key={k++} s={[0.5, FH, 0.5]} p={[px, FH / 2, pz]} c={trim} />)
      }
    }
    els.push(<Box key={k++} s={[w * 0.32, FH, d * 0.45]} p={[w * 0.22, FH / 2, -d * 0.24]} c={wall} />)
    els.push(<Box key={k++} s={[w - 0.2, 0.05, d - 0.2]} p={[0, 0.025, 0]} c="#B5AC9C" grade={false} shadow={false} />)
    els.push(<Door key={k++} p={[w * 0.22 - 0.6, 0, -d * 0.24 + d * 0.225]} c={C.WOOD} frame={trim} />)
  }

  const n = Math.max(1, Math.round(w / 3.4))
  const bay = w / n
  const m = Math.max(1, Math.round(d / 3.6))
  for (let f = stilt ? 1 : 0; f < floors; f++) {
    const base = f * FH
    for (let i = 0; i < n; i++) {
      const bx = -w / 2 + (i + 0.5) * bay
      const isBal = f > 0 && (balconies === 'all' || (balconies === 'alt' && (i + f) % 2 === 1))
      if (!stilt && f === 0 && i === 0) {
        els.push(<Door key={k++} p={[bx, 0, d / 2]} frame={trim} c={C.WOOD} />)
      } else if (isBal) {
        els.push(
          <Balcony
            key={k++}
            p={[bx, base, d / 2]}
            w={Math.min(bay - 0.5, 2.8)}
            slab={trim}
            wall={accent}
            plant={r() < 0.55}
            curtain={curtain()}
            cloth={r() < 0.35 ? CLOTHS[Math.floor(r() * CLOTHS.length)] : null}
          />,
        )
      } else {
        els.push(<Win key={k++} p={[bx, base + 1.65, d / 2]} frame={trim} grille={r() < 0.5} curtain={curtain()} />)
      }
      els.push(<Win key={k++} p={[bx, base + 1.65, -d / 2]} r={[0, Math.PI, 0]} frame={trim} curtain={curtain()} />)
    }
    for (let j = 0; j < m; j++) {
      const bz = -d / 2 + (j + 0.5) * (d / m)
      els.push(<Win key={k++} p={[w / 2, base + 1.65, bz]} r={[0, Math.PI / 2, 0]} frame={trim} grille={r() < 0.4} curtain={curtain()} />)
      els.push(<Win key={k++} p={[-w / 2, base + 1.65, bz]} r={[0, -Math.PI / 2, 0]} frame={trim} curtain={curtain()} />)
      if (f > 0 && r() < 0.3) els.push(<ACUnit key={k++} p={[w / 2, base + 0.75, bz + 1.32]} r={[0, Math.PI / 2, 0]} />)
      if (f > 0 && r() < 0.2) els.push(<ACUnit key={k++} p={[-w / 2, base + 0.75, bz - 1.32]} r={[0, -Math.PI / 2, 0]} />)
    }
  }

  els.push(<Parapet key={k++} w={w} d={d} wall={wall} trim={trim} y={H} />)
  for (let t = 0; t < tanks; t++) els.push(<Tank key={k++} p={[w / 2 - 1.5 - t * 2.0, H, -d / 2 + 1.5]} />)
  if (mumty) els.push(<Mumty key={k++} p={[-w / 2 + 2.2, H, -d / 2 + 2.0]} wall={wall} trim={trim} />)
  if (r() < 0.8) els.push(<Dish key={k++} p={[-w / 2 + 0.9, H, d / 2 - 0.9]} yaw={0.4 + r() * 0.6} />)
  if (r() < 0.65) els.push(<ClothesLine key={k++} p={[0.3, H, d / 2 - 2.0]} len={Math.min(w - 3.2, 6)} seed={seed * 13} />)
  els.push(<Cyl key={k++} rt={0.07} h={H} p={[w / 2 - 0.35, H / 2, d / 2 + 0.12]} c="#5E6168" rough={0.5} />)

  return (
    <group position={[x, BASE, z]} rotation={[0, rot, 0]}>
      {els}
    </group>
  )
}
