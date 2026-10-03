'use client'

import { C } from '@/lib/palette'
import { BASE } from '../layout'
import { Box } from './kit'

type Props = { from: [number, number]; to: [number, number]; h?: number; wall?: string; cap?: string }

/** Low painted boundary wall with a terracotta cap and pilasters. */
export function CompoundWall({ from, to, h = 1.5, wall = C.WALL_WHITE, cap = C.TERRACOTTA }: Props) {
  const dx = to[0] - from[0]
  const dz = to[1] - from[1]
  const len = Math.hypot(dx, dz)
  const ang = Math.atan2(dx, dz)
  const cx = (from[0] + to[0]) / 2
  const cz = (from[1] + to[1]) / 2
  const piers = Math.max(1, Math.round(len / 3))
  return (
    <group position={[cx, BASE, cz]} rotation={[0, ang, 0]}>
      <Box s={[0.25, h, len]} p={[0, h / 2, 0]} c={wall} />
      <Box s={[0.38, 0.12, len + 0.1]} p={[0, h + 0.06, 0]} c={cap} />
      {Array.from({ length: piers + 1 }, (_, i) => (
        <Box key={i} s={[0.42, h + 0.1, 0.42]} p={[0, (h + 0.1) / 2, -len / 2 + (i * len) / piers]} c={wall} />
      ))}
    </group>
  )
}
