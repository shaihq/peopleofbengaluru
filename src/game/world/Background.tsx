'use client'

import { C } from '@/lib/palette'
import { rbox } from '../geometry'
import { mat, texMat } from '../materials'
import { farFacadeTex, repeated, rng } from '../textures'
import { Box } from './kit'
import { RainTree } from './Trees'

// Midground → background depth layers (design.md §6.3). Simplified forms that
// dissolve into the horizon haze.

const METRO_Z = -66
const CONCRETE = '#CDBFA6'

/** Namma Metro elevated viaduct crossing the far end of the street. */
function MetroViaduct() {
  const pillars: number[] = []
  for (let x = -132; x <= 132; x += 22) pillars.push(x)
  return (
    <group position={[0, 0, METRO_Z]}>
      {pillars.map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <Box s={[1.9, 11, 1.9]} p={[0, 5.5, 0]} c={CONCRETE} radius={0.3} />
          <Box s={[6, 1.4, 3]} p={[0, 11.5, 0]} c={CONCRETE} radius={0.25} />
        </group>
      ))}
      <Box s={[290, 1.7, 9]} p={[0, 13, 0]} c={CONCRETE} radius={0.3} grade={false} />
      <Box s={[290, 0.9, 0.35]} p={[0, 14.3, 4.3]} c={C.WALL_WHITE} grade={false} />
      <Box s={[290, 0.9, 0.35]} p={[0, 14.3, -4.3]} c={C.WALL_WHITE} grade={false} />
    </group>
  )
}

type Far = [x: number, z: number, w: number, d: number, h: number, wall: string]

const WALLS = [C.WALL_MINT, C.WALL_BUTTER, C.WALL_POWDER, C.WALL_SALMON, C.WALL_PINK, C.WALL_WHITE]

/** Distant blocks lining the roads beyond the playable area. */
function farBlocks(): Far[] {
  const r = rng(77)
  const out: Far[] = []
  const pick = () => WALLS[Math.floor(r() * WALLS.length)]
  for (const s of [1, -1]) {
    for (let a = 52; a < 118; a += 13) {
      for (const side of [1, -1]) {
        const h = 6.4 + Math.floor(r() * 3) * 3.2
        out.push([s * a, side * (14 + r() * 2), 11, 11, h, pick()])
        out.push([side * (14 + r() * 2), s * a + (s < 0 ? -12 : 0), 11, 11, h, pick()])
      }
    }
    for (let a = 26; a < 50; a += 12) {
      out.push([s * a + s * 8, -s * 34, 11, 11, 9.6, pick()])
      out.push([s * 34, s * a + s * 20, 11, 11, 6.4 + Math.floor(r() * 2) * 3.2, pick()])
    }
  }
  // keep clear of the metro viaduct
  return out.filter(([, z]) => Math.abs(z - METRO_Z) > 11)
}

function FarBlock({ b: [x, z, w, d, h, wall] }: { b: Far }) {
  const m = texMat(`far|${wall}|${w}|${h}`, () => repeated(farFacadeTex(wall), w / 6, h / 6.4), { rough: 0.9, grade: true })
  return (
    <group position={[x, 0.15, z]}>
      <mesh geometry={rbox(w, h, d, 0.15)} material={m} position={[0, h / 2, 0]} castShadow receiveShadow />
      <mesh geometry={rbox(w + 0.2, 0.7, d + 0.2, 0.08)} material={mat(C.WALL_WHITE)} position={[0, h + 0.35, 0]} />
      <mesh geometry={rbox(1.4, 1.4, 1.4, 0.3)} material={mat(C.TANK, { grade: false })} position={[w / 4, h + 1.4, -d / 4]} />
    </group>
  )
}

/** Tech-park towers far away — skyline silhouettes only, never foreground (design.md §6.2). */
function Skyline() {
  const towers: [number, number, number, number, number, string][] = [
    [-170, -330, 30, 24, 70, '#8FB3CC'],
    [-118, -360, 24, 22, 92, '#D9E0E4'],
    [-64, -320, 32, 22, 56, '#9DBBD0'],
    [-14, -370, 26, 26, 104, '#8FB3CC'],
    [44, -340, 30, 20, 76, '#D9E0E4'],
    [98, -365, 24, 24, 112, '#9DBBD0'],
    [150, -330, 34, 26, 64, '#8FB3CC'],
    [210, -300, 28, 22, 82, '#D9E0E4'],
  ]
  return (
    <>
      {towers.map(([x, z, w, d, h, c]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh geometry={rbox(w, h, d, 0.6)} material={mat(c, { rough: 0.35, metal: 0.2, grade: false })} position={[0, h / 2, 0]} />
          <mesh geometry={rbox(w * 0.6, 5, d * 0.6, 0.5)} material={mat(C.WALL_WHITE, { grade: false })} position={[0, h + 2.5, 0]} />
        </group>
      ))}
    </>
  )
}

/** Tree masses that fill the gaps between distant blocks. */
function TreeMasses() {
  const r = rng(91)
  const pts: [number, number, number, number][] = []
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2
    const d = 58 + r() * 48
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d
    if (Math.abs(x) < 9 || Math.abs(z) < 9) continue
    pts.push([x, z, 1.1 + r() * 0.6, 200 + i])
  }
  return (
    <>
      {pts.map(([x, z, s, seed]) => (
        <RainTree key={seed} p={[x, 0.15, z]} s={s} seed={200 + (seed % 5)} detail={2} />
      ))}
    </>
  )
}

export function Background() {
  return (
    <>
      <MetroViaduct />
      {farBlocks().map((b, i) => (
        <FarBlock key={i} b={b} />
      ))}
      <Skyline />
      <TreeMasses />
    </>
  )
}
