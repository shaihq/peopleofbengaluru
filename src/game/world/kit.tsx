'use client'

import * as THREE from 'three'
import { useMemo } from 'react'
import { C } from '@/lib/palette'
import { glassMat, leafMat, mat, texMat } from '../materials'
import { canopyGeo, cyl, plane, rbox } from '../geometry'
import { rng, shutterTex, signTexture, stripeTex, useFontsReady, repeated, type SignSpec } from '../textures'

// The building kit (design.md §6.1). Every building in the district is
// assembled from these pieces, configured and placed by hand.

export type V3 = [number, number, number]

type BoxProps = {
  s: V3
  p?: V3
  r?: V3
  c?: string
  rough?: number
  metal?: number
  grade?: boolean
  radius?: number
  shadow?: boolean
  material?: THREE.Material
}

export function Box({ s, p, r, c = C.WALL_WHITE, rough, metal, grade, radius, shadow = true, material }: BoxProps) {
  return (
    <mesh
      geometry={rbox(s[0], s[1], s[2], radius)}
      material={material ?? mat(c, { rough, metal, grade })}
      position={p}
      rotation={r}
      castShadow={shadow}
      receiveShadow
    />
  )
}

type CylProps = { rt: number; rb?: number; h: number; p?: V3; r?: V3; c: string; rough?: number; metal?: number; grade?: boolean; seg?: number; shadow?: boolean }

export function Cyl({ rt, rb, h, p, r, c, rough, metal, grade, seg, shadow = true }: CylProps) {
  return (
    <mesh
      geometry={cyl(rt, rb ?? rt, h, seg)}
      material={mat(c, { rough, metal, grade })}
      position={p}
      rotation={r}
      castShadow={shadow}
      receiveShadow
    />
  )
}

// ---------------------------------------------------------------------------

type WinProps = {
  p: V3
  r?: V3
  w?: number
  h?: number
  frame?: string
  grille?: boolean
  shade?: boolean
  shadeColor?: string
  curtain?: string | null
  door?: boolean
}

/** Window placed on a wall surface (local +Z = outward). Frame protrudes so the glass reads as recessed. */
export function Win({ p, r, w = 1.3, h = 1.5, frame = C.WALL_WHITE, grille = false, shade = true, shadeColor, curtain, door }: WinProps) {
  const t = 0.13
  const dp = 0.16
  const bars = grille ? Math.max(2, Math.round(w / 0.3)) : 0
  return (
    <group position={p} rotation={r}>
      <Box s={[w + t * 2, t, dp]} p={[0, h / 2 + t / 2, dp / 2]} c={frame} />
      {!door && <Box s={[w + t * 2, t, dp]} p={[0, -h / 2 - t / 2, dp / 2]} c={frame} />}
      <Box s={[t, h, dp]} p={[-w / 2 - t / 2, 0, dp / 2]} c={frame} />
      <Box s={[t, h, dp]} p={[w / 2 + t / 2, 0, dp / 2]} c={frame} />
      <Box s={[0.07, h, 0.06]} p={[0, 0, 0.04]} c={frame} shadow={false} />
      <mesh geometry={plane(w, h)} material={glassMat()} position={[0, 0, 0.012]} receiveShadow />
      {curtain && (
        <mesh geometry={plane(w * 0.42, h * 0.94)} material={mat(curtain, { grade: false })} position={[-w * 0.27, 0, 0.018]} />
      )}
      {!door && <Box s={[w + 0.46, 0.1, 0.3]} p={[0, -h / 2 - t - 0.05, 0.15]} c={frame} />}
      {shade && <Box s={[w + 0.7, 0.11, 0.6]} p={[0, h / 2 + t + 0.14, 0.3]} c={shadeColor ?? frame} />}
      {Array.from({ length: bars }, (_, i) => (
        <Box
          key={i}
          s={[0.045, h, 0.045]}
          p={[-w / 2 + ((i + 1) * w) / (bars + 1), 0, 0.08]}
          c={C.GRILLE}
          rough={0.5}
          metal={0.4}
          grade={false}
          shadow={false}
        />
      ))}
    </group>
  )
}

export function Door({ p, r, w = 1.1, h = 2.2, c = C.WOOD, frame = C.WALL_WHITE }: { p: V3; r?: V3; w?: number; h?: number; c?: string; frame?: string }) {
  return (
    <group position={p} rotation={r}>
      <Box s={[w, h, 0.08]} p={[0, h / 2, 0.04]} c={c} rough={0.7} />
      <Box s={[w * 0.36, h * 0.36, 0.04]} p={[-w * 0.2, h * 0.68, 0.09]} c={c} rough={0.7} shadow={false} />
      <Box s={[w * 0.36, h * 0.36, 0.04]} p={[w * 0.2, h * 0.68, 0.09]} c={c} rough={0.7} shadow={false} />
      <Box s={[w + 0.26, 0.13, 0.16]} p={[0, h + 0.065, 0.08]} c={frame} />
      <Box s={[0.13, h, 0.16]} p={[-w / 2 - 0.065, h / 2, 0.08]} c={frame} />
      <Box s={[0.13, h, 0.16]} p={[w / 2 + 0.065, h / 2, 0.08]} c={frame} />
    </group>
  )
}

// ---------------------------------------------------------------------------

type BalconyProps = {
  p: V3
  r?: V3
  w?: number
  depth?: number
  slab?: string
  wall?: string
  plant?: boolean
  curtain?: string | null
  /** A towel or dupatta drying over the rail. */
  cloth?: string | null
}

/** Projecting balcony with low parapet, grille rail and a french door. Origin = floor level on the facade. */
export function Balcony({ p, r, w = 2.6, depth = 1.1, slab = C.WALL_WHITE, wall = C.TERRACOTTA, plant, curtain, cloth }: BalconyProps) {
  const bars = Math.round(w / 0.24)
  return (
    <group position={p} rotation={r}>
      <Box s={[w, 0.18, depth]} p={[0, 0.09, depth / 2]} c={slab} />
      <Box s={[w, 0.55, 0.14]} p={[0, 0.455, depth - 0.07]} c={wall} />
      <Box s={[0.14, 0.55, depth - 0.14]} p={[-w / 2 + 0.07, 0.455, (depth - 0.14) / 2]} c={wall} />
      <Box s={[0.14, 0.55, depth - 0.14]} p={[w / 2 - 0.07, 0.455, (depth - 0.14) / 2]} c={wall} />
      <Box s={[w, 0.07, 0.07]} p={[0, 1.08, depth - 0.07]} c={C.GRILLE} metal={0.4} rough={0.5} grade={false} />
      {Array.from({ length: bars }, (_, i) => (
        <Box
          key={i}
          s={[0.04, 0.34, 0.04]}
          p={[-w / 2 + ((i + 0.5) * w) / bars, 0.9, depth - 0.07]}
          c={C.GRILLE}
          metal={0.4}
          rough={0.5}
          grade={false}
          shadow={false}
        />
      ))}
      <Win p={[0, 1.29, 0]} w={1.0} h={2.2} door shade={false} frame={slab} curtain={curtain} />
      {plant && <Pot p={[w / 2 - 0.42, 0.18, depth - 0.38]} />}
      {cloth && (
        <group position={[-w / 4, 0, depth - 0.07]}>
          <Box s={[0.8, 0.05, 0.16]} p={[0, 1.13, 0]} c={cloth} rough={0.95} grade={false} shadow={false} />
          <Box s={[0.8, 0.62, 0.035]} p={[0, 0.82, 0.075]} c={cloth} rough={0.95} grade={false} />
        </group>
      )}
    </group>
  )
}

export function Pot({ p, s = 1 }: { p: V3; s?: number }) {
  const geo = useMemo(
    () =>
      canopyGeo(
        [
          [0, 0.45, 0, 0.26],
          [0.14, 0.38, 0.06, 0.2],
          [-0.12, 0.4, -0.05, 0.2],
        ],
        { seed: 501, deep: C.LEAF_DEEP, mid: C.LEAF_MID, light: C.LEAF_LIGHT, detail: 2 },
      ),
    [],
  )
  return (
    <group position={p} scale={s}>
      <Cyl rt={0.17} rb={0.13} h={0.32} p={[0, 0.16, 0]} c={C.TERRACOTTA} rough={0.8} grade={false} />
      <mesh geometry={geo} material={leafMat()} castShadow />
    </group>
  )
}

// ---------------------------------------------------------------------------

/** Black Sintex-style rooftop water tank on a concrete stand. */
export function Tank({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <Box s={[1.7, 0.45, 1.7]} p={[0, 0.225, 0]} c={C.CONCRETE_AGED} grade={false} />
      <Cyl rt={0.66} rb={0.74} h={1.3} p={[0, 1.1, 0]} c={C.TANK} rough={0.55} grade={false} />
      <Cyl rt={0.775} h={0.07} p={[0, 0.85, 0]} c={C.TANK} rough={0.55} grade={false} />
      <Cyl rt={0.715} h={0.07} p={[0, 1.32, 0]} c={C.TANK} rough={0.55} grade={false} />
      <Cyl rt={0.3} rb={0.62} h={0.22} p={[0, 1.86, 0]} c={C.TANK} rough={0.55} grade={false} />
      <Cyl rt={0.26} h={0.1} p={[0, 2.01, 0]} c={C.TANK} rough={0.55} grade={false} />
    </group>
  )
}

/** Rooftop stair-head room ("mumty"). */
export function Mumty({ p, wall, trim = C.WALL_WHITE }: { p: V3; wall: string; trim?: string }) {
  return (
    <group position={p}>
      <Box s={[3, 2.6, 3]} p={[0, 1.3, 0]} c={wall} grade={false} />
      <Box s={[3.4, 0.14, 3.4]} p={[0, 2.67, 0]} c={trim} grade={false} />
      <Door p={[0.5, 0, 1.5]} w={0.9} h={2.0} c={C.WOOD} frame={trim} />
    </group>
  )
}

/** Perimeter parapet on a flat roof. Origin = roof level, centered. */
export function Parapet({ w, d, wall, trim = C.WALL_WHITE, y }: { w: number; d: number; wall: string; trim?: string; y: number }) {
  const t = 0.22
  const h = 0.9
  return (
    <group position={[0, y, 0]}>
      <Box s={[w, h, t]} p={[0, h / 2, d / 2 - t / 2]} c={wall} grade={false} />
      <Box s={[w, h, t]} p={[0, h / 2, -d / 2 + t / 2]} c={wall} grade={false} />
      <Box s={[t, h, d - t * 2]} p={[w / 2 - t / 2, h / 2, 0]} c={wall} grade={false} />
      <Box s={[t, h, d - t * 2]} p={[-w / 2 + t / 2, h / 2, 0]} c={wall} grade={false} />
      <Box s={[w + 0.12, 0.1, t + 0.12]} p={[0, h + 0.05, d / 2 - t / 2]} c={trim} grade={false} />
      <Box s={[w + 0.12, 0.1, t + 0.12]} p={[0, h + 0.05, -d / 2 + t / 2]} c={trim} grade={false} />
      <Box s={[t + 0.12, 0.1, d]} p={[w / 2 - t / 2, h + 0.05, 0]} c={trim} grade={false} />
      <Box s={[t + 0.12, 0.1, d]} p={[-w / 2 + t / 2, h + 0.05, 0]} c={trim} grade={false} />
    </group>
  )
}

// ---------------------------------------------------------------------------

type SignProps = { p: V3; r?: V3; w: number; h: number; spec: SignSpec; frame?: string; depth?: number }

/** Hand-painted signboard: Kannada + English. */
export function Sign({ p, r, w, h, spec, frame = C.GRILLE, depth = 0.12 }: SignProps) {
  useFontsReady()
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ map: signTexture(spec, w, h), roughness: 0.72 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec.title, spec.kn, spec.sub, spec.bg, spec.fg, w, h],
  )
  return (
    <group position={p} rotation={r}>
      <Box s={[w + 0.14, h + 0.14, depth]} c={frame} rough={0.6} grade={false} />
      <mesh geometry={plane(w, h)} material={material} position={[0, 0, depth / 2 + 0.006]} receiveShadow />
    </group>
  )
}

/** Sloped canvas awning hinged at the wall. Origin = hinge line, centered. */
export function Awning({ p, r, w, depth = 1.5, a, b, drop = 0.38 }: { p: V3; r?: V3; w: number; depth?: number; a: string; b: string; drop?: number }) {
  const len = depth / Math.cos(drop)
  const m = texMat(`awning|${a}|${b}|${w}`, () => repeated(stripeTex(a, b), w, 1), { rough: 0.9 })
  return (
    <group position={p} rotation={r}>
      <mesh
        geometry={rbox(w, 0.05, len)}
        material={m}
        position={[0, (-Math.sin(drop) * len) / 2, depth / 2]}
        rotation={[drop, 0, 0]}
        castShadow
        receiveShadow
      />
      <mesh geometry={rbox(w, 0.3, 0.04)} material={m} position={[0, -Math.sin(drop) * len - 0.13, depth]} castShadow receiveShadow />
    </group>
  )
}

/** Rolling shutter panel. */
export function Shutter({ p, w, h }: { p: V3; w: number; h: number }) {
  const m = texMat(`shutter|${h.toFixed(2)}`, () => repeated(shutterTex(), 1, h / 0.12), { rough: 0.55, metal: 0.35 })
  return <Box s={[w, h, 0.06]} p={p} material={m} />
}

// ---------------------------------------------------------------------------
// Rooftop + facade life
// ---------------------------------------------------------------------------

/** DTH satellite dish on a short mast. */
export function Dish({ p, yaw = 0 }: { p: V3; yaw?: number }) {
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      <Box s={[0.5, 0.08, 0.5]} p={[0, 0.04, 0]} c={C.CONCRETE_AGED} grade={false} />
      <Cyl rt={0.035} h={0.8} p={[0, 0.44, 0]} c={C.GRILLE} metal={0.4} rough={0.5} grade={false} />
      <Cyl rt={0.42} rb={0.07} h={0.14} p={[0, 0.88, 0.08]} r={[-1.05, 0, 0]} c="#E4DFD6" rough={0.5} grade={false} />
      <Box s={[0.035, 0.035, 0.45]} p={[0, 0.98, 0.3]} r={[-0.5, 0, 0]} c={C.GRILLE} grade={false} shadow={false} />
    </group>
  )
}

/** Split-AC outdoor unit on a wall bracket. Local +Z = outward from the wall. */
export function ACUnit({ p, r }: { p: V3; r?: V3 }) {
  return (
    <group position={p} rotation={r}>
      <Box s={[0.82, 0.04, 0.4]} p={[0, -0.3, 0.2]} c={C.GRILLE} metal={0.4} rough={0.5} grade={false} />
      <Box s={[0.8, 0.56, 0.32]} p={[0, 0, 0.18]} c="#ECE8E0" rough={0.55} grade={false} />
      <Cyl rt={0.2} h={0.03} p={[-0.12, 0, 0.345]} r={[Math.PI / 2, 0, 0]} c="#8E949C" metal={0.3} rough={0.5} grade={false} shadow={false} />
    </group>
  )
}

const CLOTH = [C.FLAME, C.BMTC_BLUE, C.KERB_YELLOW, C.WALL_PINK, C.AUTO_GREEN, C.WALL_WHITE, C.BOUGAIN, C.WALL_POWDER]

/** Rooftop clothes line — sarees, shirts and towels drying in the sun. */
export function ClothesLine({ p, len, yaw = 0, seed }: { p: V3; len: number; yaw?: number; seed: number }) {
  const r = rng(seed)
  const pieces: { x: number; w: number; h: number; c: string; t: number }[] = []
  let x = -len / 2 + 0.35
  while (x < len / 2 - 0.5) {
    const saree = r() < 0.25
    const w = saree ? 0.9 : 0.4 + r() * 0.3
    pieces.push({ x: x + w / 2, w, h: saree ? 1.25 : 0.45 + r() * 0.35, c: CLOTH[Math.floor(r() * CLOTH.length)], t: (r() - 0.5) * 0.2 })
    x += w + 0.12 + r() * 0.25
  }
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      {[-len / 2, len / 2].map((px) => (
        <Box key={px} s={[0.06, 1.75, 0.06]} p={[px, 0.875, 0]} c={C.GRILLE} metal={0.4} rough={0.5} grade={false} />
      ))}
      <Box s={[len, 0.018, 0.018]} p={[0, 1.68, 0]} c="#E4DFD6" grade={false} shadow={false} />
      {pieces.map((pc, i) => (
        <Box key={i} s={[pc.w, pc.h, 0.025]} p={[pc.x, 1.68 - pc.h / 2, 0]} r={[0, pc.t, 0]} c={pc.c} rough={0.95} grade={false} />
      ))}
    </group>
  )
}
