'use client'

import * as THREE from 'three'
import { useMemo } from 'react'
import { C } from '@/lib/palette'
import {
  BASE,
  COCONUT_CART,
  CRATES,
  DUSTBIN,
  MANHOLES,
  POSTERS,
  RANGOLI,
  ROAD,
  SCOOTERS,
  STREET_SIGNS,
  TREES,
} from '../layout'
import { plane, rbox, sphere } from '../geometry'
import { mat } from '../materials'
import { grimeTex, petalsTex, rangoliTex, repeated, rng, signTexture, stripeTex, useFontsReady, type SignSpec } from '../textures'
import { Box, Cyl, Sign, type V3 } from './kit'

// Street life (design.md §6.2): the small things that make it unmistakably Bengaluru.

const DARK = '#25272C'

// ---------------------------------------------------------------------------

/** Tender-coconut cart under a striped umbrella. Local +Z = handle side. */
function CoconutCart() {
  const { x, z, rot } = COCONUT_CART
  const umbrella = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: repeated(stripeTex(C.WALL_WHITE, C.BMTC_BLUE), 6, 1), roughness: 0.85, side: THREE.DoubleSide })
    const g = new THREE.CylinderGeometry(0.06, 1.3, 0.5, 24, 1, true)
    return { m, g }
  }, [])
  const nuts = useMemo(() => {
    const r = rng(55)
    const out: { p: V3; c: string }[] = []
    const cols = ['#8DB04A', '#9DBF55', '#76A03F']
    const layers: [number, number, number][] = [
      [5, 9, 0],
      [3, 7, 1],
      [1, 5, 2],
    ]
    for (const [nx, nz, l] of layers)
      for (let i = 0; i < nx; i++)
        for (let j = 0; j < nz; j++)
          out.push({
            p: [(i - (nx - 1) / 2) * 0.27 + (r() - 0.5) * 0.04, 0.95 + l * 0.22, (j - (nz - 1) / 2) * 0.2 + (r() - 0.5) * 0.04],
            c: cols[Math.floor(r() * cols.length)],
          })
    return out
  }, [])
  return (
    <group position={[x, BASE, z]} rotation={[0, rot, 0]}>
      <Box s={[1.4, 0.1, 2.0]} p={[0, 0.8, 0]} c={C.WOOD} rough={0.8} />
      {[-0.68, 0.68].map((sx) => (
        <Box key={sx} s={[0.06, 0.18, 2.0]} p={[sx, 0.92, 0]} c={C.WOOD} rough={0.8} />
      ))}
      {[-0.6, 0.6].map((sx) => (
        <group key={sx}>
          <Cyl rt={0.34} h={0.08} p={[sx, 0.34, -0.55]} r={[0, 0, Math.PI / 2]} c={DARK} rough={0.7} grade={false} />
          <Cyl rt={0.1} h={0.1} p={[sx, 0.34, -0.55]} r={[0, 0, Math.PI / 2]} c={C.STEEL} metal={0.5} rough={0.4} grade={false} />
          <Box s={[0.08, 0.76, 0.08]} p={[sx, 0.38, 0.85]} c={C.WOOD} rough={0.8} />
          <Box s={[0.06, 0.06, 0.9]} p={[sx * 0.7, 0.84, 1.4]} c={C.WOOD} rough={0.8} />
        </group>
      ))}
      {nuts.map((n, i) => (
        <mesh key={i} geometry={sphere(0.13, 12, 9)} material={mat(n.c, { rough: 0.6, grade: false })} position={n.p} scale={[1, 0.9, 1.1]} castShadow />
      ))}
      <Cyl rt={0.03} h={2.3} p={[0.5, 1.95, -0.7]} c={C.GRILLE} metal={0.4} rough={0.5} grade={false} />
      <mesh geometry={umbrella.g} material={umbrella.m} position={[0.5, 3.05, -0.7]} castShadow receiveShadow />
      {/* a few on the ground, one opened */}
      {[
        [-0.95, 0.12, 0.5],
        [-1.1, 0.12, 0.2],
        [-0.85, 0.12, 0.0],
      ].map((p, i) => (
        <mesh key={i} geometry={sphere(0.13, 12, 9)} material={mat('#8DB04A', { rough: 0.6, grade: false })} position={p as V3} castShadow />
      ))}
    </group>
  )
}

/** Gearless scooter — the vehicle of the city. Local +Z = front. */
function Scooter({ x, z, rot, color }: { x: number; z: number; rot: number; color: string }) {
  const body = { c: color, rough: 0.35, metal: 0.15, grade: false }
  return (
    <group position={[x, BASE, z]} rotation={[0, rot, 0]}>
      {[0.62, -0.58].map((wz) => (
        <group key={wz}>
          <Cyl rt={0.25} h={0.11} p={[0, 0.25, wz]} r={[0, 0, Math.PI / 2]} c={DARK} rough={0.75} grade={false} />
          <Cyl rt={0.12} h={0.13} p={[0, 0.25, wz]} r={[0, 0, Math.PI / 2]} c={C.STEEL} metal={0.6} rough={0.35} grade={false} />
        </group>
      ))}
      <Box s={[0.42, 0.08, 0.62]} p={[0, 0.33, 0.04]} c="#4A4D55" rough={0.6} grade={false} />
      <Box s={[0.5, 0.44, 0.88]} p={[0, 0.6, -0.36]} radius={0.17} {...body} />
      <Box s={[0.4, 0.13, 0.72]} p={[0, 0.88, -0.32]} radius={0.06} c="#2B2D33" rough={0.7} grade={false} />
      <Box s={[0.48, 0.78, 0.16]} p={[0, 0.66, 0.4]} r={[-0.22, 0, 0]} radius={0.07} {...body} />
      <Box s={[0.24, 0.1, 0.42]} p={[0, 0.53, 0.64]} radius={0.04} {...body} />
      <Cyl rt={0.035} h={0.55} p={[0, 1.02, 0.47]} r={[-0.25, 0, 0]} c="#4A4D55" metal={0.4} rough={0.5} grade={false} />
      <Box s={[0.72, 0.06, 0.06]} p={[0, 1.24, 0.42]} c={DARK} rough={0.6} grade={false} />
      <Box s={[0.3, 0.2, 0.2]} p={[0, 1.2, 0.5]} radius={0.07} {...body} />
      <Cyl rt={0.075} h={0.04} p={[0, 1.2, 0.61]} r={[Math.PI / 2, 0, 0]} c="#FFF6E5" rough={0.2} grade={false} shadow={false} />
    </group>
  )
}

function StreetSign({ x, z, rot, spec }: { x: number; z: number; rot: number; spec: SignSpec }) {
  return (
    <group position={[x, BASE, z]} rotation={[0, rot, 0]}>
      <Cyl rt={0.05} h={2.9} p={[0, 1.45, 0]} c={C.GRILLE} metal={0.4} rough={0.5} grade={false} />
      <Sign p={[0, 2.55, 0.06]} w={1.9} h={0.78} spec={spec} frame={C.WALL_WHITE} depth={0.06} />
    </group>
  )
}

/** Hand-pasted paper poster, slightly crooked. */
function Poster({ x, z, rot, spec, i }: { x: number; z: number; rot: number; spec: SignSpec; i: number }) {
  useFontsReady()
  const m = useMemo(() => new THREE.MeshStandardMaterial({ map: signTexture(spec, 0.86, 1.08), roughness: 0.9 }), [spec])
  const n = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot)).multiplyScalar(0.01)
  return (
    <mesh
      geometry={plane(0.86, 1.08)}
      material={m}
      position={[x + n.x, BASE + 0.8, z + n.z]}
      rotation={[0, rot, (i % 2 ? 1 : -1) * 0.035]}
      receiveShadow
    />
  )
}

function Decal({ p, size, tex, rot = 0 }: { p: V3; size: number; tex: THREE.Texture; rot?: number }) {
  const m = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, roughness: 0.95 }), [tex])
  return <mesh geometry={plane(size, size)} material={m} position={p} rotation={[-Math.PI / 2, 0, rot]} receiveShadow />
}

function Manhole({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <Cyl rt={0.56} h={0.02} p={[0, 0.01, 0]} c="#8A8B8F" rough={0.6} metal={0.3} grade={false} shadow={false} />
      <Cyl rt={0.47} h={0.03} p={[0, 0.015, 0]} c="#6E6F74" rough={0.45} metal={0.45} grade={false} shadow={false} />
      {[-0.24, 0, 0.24].map((o) => (
        <Box key={o} s={[0.07, 0.02, 0.78 - Math.abs(o) * 0.9]} p={[o, 0.035, 0]} c="#5E5F64" metal={0.45} rough={0.45} grade={false} shadow={false} />
      ))}
    </group>
  )
}

/** Slab-covered storm drain running just inside every kerb. */
function DrainCovers() {
  const slabs: { p: V3; r: number; c: string }[] = []
  const r = rng(303)
  for (const sx of [1, -1])
    for (const sz of [1, -1])
      for (let k = 0; k < 52; k++) {
        const along = ROAD + 0.55 + k * 1.0
        const c = r() < 0.5 ? C.CONCRETE_AGED : '#C4B49A'
        slabs.push({ p: [sx * along, BASE + 0.012, sz * (ROAD + 0.4)], r: 0, c })
        slabs.push({ p: [sx * (ROAD + 0.4), BASE + 0.012, sz * along], r: Math.PI / 2, c })
      }
  return (
    <>
      {slabs.map((s, i) => (
        <mesh key={i} geometry={rbox(0.94, 0.05, 0.56, 0.02)} material={mat(s.c, { rough: 0.9, grade: false })} position={s.p} rotation={[0, s.r, 0]} receiveShadow />
      ))}
    </>
  )
}

/** Dust and tyre grime collecting against the kerb. */
function KerbGrime() {
  const len = 60 - ROAD
  const mid = (ROAD + 60) / 2
  const m = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: repeated(grimeTex(), len / 4, 1),
        transparent: true,
        depthWrite: false,
        roughness: 1,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    [len],
  )
  const strips: { p: V3; t: number }[] = []
  for (const sx of [1, -1])
    for (const sz of [1, -1]) {
      strips.push({ p: [sx * mid, 0.008, sz * (ROAD - 0.45)], t: Math.atan2(0, -sz) })
      strips.push({ p: [sx * (ROAD - 0.45), 0.008, sz * mid], t: Math.atan2(-sx, 0) })
    }
  return (
    <>
      {strips.map((s, i) => (
        <mesh key={i} geometry={plane(len, 0.9)} material={m} position={s.p} rotation={[-Math.PI / 2, 0, s.t]} renderOrder={1} userData={{ noMerge: true }} />
      ))}
    </>
  )
}

function Crates({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, BASE, z]}>
      {[
        [0, 0.15, 0, C.SIGN_RED],
        [0, 0.45, 0, C.BMTC_BLUE],
        [0.04, 0.75, 0.02, C.SIGN_RED],
      ].map(([cx, cy, cz, c], i) => (
        <group key={i} position={[cx as number, cy as number, cz as number]} rotation={[0, i * 0.08, 0]}>
          <Box s={[0.5, 0.3, 0.38]} c={c as string} rough={0.5} grade={false} />
          <Box s={[0.42, 0.04, 0.3]} p={[0, 0.14, 0]} c="#3B2A22" rough={0.8} grade={false} shadow={false} />
        </group>
      ))}
    </group>
  )
}

function Dustbin({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, BASE, z]}>
      <Cyl rt={0.3} rb={0.26} h={0.82} p={[0, 0.41, 0]} c={C.RAIL_GREEN} rough={0.5} grade={false} />
      <Cyl rt={0.33} h={0.07} p={[0, 0.85, 0]} c="#2F5E3A" rough={0.5} grade={false} />
      <Box s={[0.34, 0.16, 0.02]} p={[0, 0.55, 0.285]} c={C.WALL_WHITE} grade={false} shadow={false} />
    </group>
  )
}

export function StreetLife() {
  return (
    <>
      <CoconutCart />
      {SCOOTERS.map((s, i) => (
        <Scooter key={i} {...s} />
      ))}
      {STREET_SIGNS.map((s, i) => (
        <StreetSign key={i} {...s} />
      ))}
      {POSTERS.map((p, i) => (
        <Poster key={i} i={i} {...p} />
      ))}
      {RANGOLI.map((r) => (
        <Decal key={r.seed} p={[r.x, BASE + 0.008, r.z]} size={r.s} tex={rangoliTex(r.seed)} />
      ))}
      {TREES.filter((t) => t.kind === 'gulmohar').map((t) => (
        <Decal key={t.seed} p={[t.x, BASE + 0.075, t.z]} size={4.2 * t.s} tex={petalsTex()} rot={t.seed} />
      ))}
      {MANHOLES.map(([x, z], i) => (
        <Manhole key={i} x={x} z={z} />
      ))}
      <DrainCovers />
      <KerbGrime />
      <Crates {...CRATES} />
      <Dustbin {...DUSTBIN} />
    </>
  )
}
