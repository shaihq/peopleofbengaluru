'use client'

import type { ReactElement } from 'react'
import { C } from '@/lib/palette'
import { BASE, PARK } from '../layout'
import { texMat } from '../materials'
import { grassTex, repeated } from '../textures'
import { Box } from './kit'
import { Bush } from './Trees'

const RAIL = { c: C.RAIL_GREEN, rough: 0.5, metal: 0.25, grade: false }

/** Green-painted municipal railing between concrete posts. */
function Railing({ from, to }: { from: [number, number]; to: [number, number] }) {
  const dx = to[0] - from[0]
  const dz = to[1] - from[1]
  const len = Math.hypot(dx, dz)
  const ang = Math.atan2(dx, dz)
  const posts = Math.max(1, Math.round(len / 2.6))
  const pickets = Math.floor(len / 0.28)
  const els: ReactElement[] = []
  for (let i = 0; i <= posts; i++) {
    const z = -len / 2 + (i * len) / posts
    els.push(<Box key={`p${i}`} s={[0.26, 1.15, 0.26]} p={[0, 0.575, z]} c={C.WALL_WHITE} />)
    els.push(<Box key={`c${i}`} s={[0.32, 0.08, 0.32]} p={[0, 1.19, z]} c={C.WALL_WHITE} />)
  }
  for (let i = 0; i < pickets; i++) {
    els.push(<Box key={`k${i}`} s={[0.045, 0.85, 0.045]} p={[0, 0.55, -len / 2 + 0.14 + i * 0.28]} {...RAIL} shadow={false} />)
  }
  els.push(<Box key="t" s={[0.08, 0.08, len]} p={[0, 0.98, 0]} {...RAIL} />)
  els.push(<Box key="b" s={[0.08, 0.08, len]} p={[0, 0.18, 0]} {...RAIL} />)
  return (
    <group position={[(from[0] + to[0]) / 2, BASE, (from[1] + to[1]) / 2]} rotation={[0, ang, 0]}>
      {els}
    </group>
  )
}

function Bench({ p, rot = 0 }: { p: [number, number]; rot?: number }) {
  return (
    <group position={[p[0], BASE + 0.08, p[1]]} rotation={[0, rot, 0]}>
      {[-0.75, 0.75].map((x) => (
        <Box key={x} s={[0.18, 0.42, 0.5]} p={[x, 0.21, 0]} c={C.CONCRETE_AGED} />
      ))}
      <Box s={[2.1, 0.12, 0.6]} p={[0, 0.48, 0]} c="#8F8E8A" rough={0.5} />
    </group>
  )
}

/** 5th Block Park — railings, lawn, terracotta walking loop, benches, hedges. */
export function Park() {
  const { x0, x1, z0, z1, gate } = PARK
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  const sx = x1 - x0
  const sz = z1 - z0
  const lawn = texMat('lawn', () => repeated(grassTex(), sx / 4, sz / 4), { rough: 0.95 })
  const L = 7 // walking loop half-size around (20,20)
  const pw = 1.6
  const path = { c: C.PATH, rough: 0.9, grade: false, shadow: false }
  return (
    <>
      <Box s={[sx - 0.3, 0.06, sz - 0.3]} p={[cx, BASE + 0.03, cz]} material={lawn} shadow={false} />
      <Box s={[2 * L + pw, 0.05, pw]} p={[20, BASE + 0.07, 20 - L]} {...path} />
      <Box s={[2 * L + pw, 0.05, pw]} p={[20, BASE + 0.07, 20 + L]} {...path} />
      <Box s={[pw, 0.05, 2 * L - pw]} p={[20 - L, BASE + 0.07, 20]} {...path} />
      <Box s={[pw, 0.05, 2 * L - pw]} p={[20 + L, BASE + 0.07, 20]} {...path} />
      {/* entry path from the corner gate */}
      <Box s={[pw, 0.05, 4.6]} p={[10.6, BASE + 0.07, 11.0]} {...path} />
      <Box s={[2.8, 0.05, pw]} p={[11.6, BASE + 0.07, 13.0]} {...path} />

      <Railing from={[gate[1], z0]} to={[x1, z0]} />
      <Railing from={[x0, z0 + 0.6]} to={[x0, z1]} />
      <Railing from={[x0, z1]} to={[x1, z1]} />
      <Railing from={[x1, z0]} to={[x1, z1]} />
      {/* gate posts */}
      {[
        [x0, z0],
        [gate[1], z0],
      ].map(([gx, gz]) => (
        <group key={gx} position={[gx, BASE, gz]}>
          <Box s={[0.5, 1.7, 0.5]} p={[0, 0.85, 0]} c={C.WALL_WHITE} />
          <Box s={[0.62, 0.12, 0.62]} p={[0, 1.76, 0]} c={C.RAIL_GREEN} />
        </group>
      ))}

      <Bench p={[16, 14.5]} />
      <Bench p={[25, 20]} rot={Math.PI / 2} />
      <Bench p={[16, 26]} rot={Math.PI} />

      <Bush p={[10.5, BASE + 0.2, 30]} s={1.4} seed={71} />
      <Bush p={[12.4, BASE + 0.2, 30.4]} s={1.1} seed={72} />
      <Bush p={[30.3, BASE + 0.2, 30.2]} s={1.3} seed={73} />
      <Bush p={[30.4, BASE + 0.2, 23]} s={1.0} seed={74} />
      <Bush p={[14.2, BASE + 0.2, 10.4]} s={1.0} seed={75} flower={C.BOUGAIN} />
    </>
  )
}
