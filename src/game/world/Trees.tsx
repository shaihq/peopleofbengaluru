'use client'

import * as THREE from 'three'
import { useMemo } from 'react'
import { C } from '@/lib/palette'
import { canopyGeo, cyl } from '../geometry'
import { leafMat, mat } from '../materials'
import { BASE, TREES } from '../layout'
import { rng } from '../textures'
import { Cyl, type V3 } from './kit'

function rainBlobs(seed: number) {
  const r = rng(seed)
  const b: number[][] = []
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.3
    const rad = 3.3 + r() * 0.6
    b.push([Math.cos(a) * rad, 5.4 + r() * 0.6, Math.sin(a) * rad, 1.8 + r() * 0.5])
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r()
    b.push([Math.cos(a) * 1.6, 6.3 + r() * 0.4, Math.sin(a) * 1.6, 2.0 + r() * 0.4])
  }
  b.push([0, 6.9, 0, 2.0])
  return b
}

function gulmoharBlobs(seed: number) {
  const r = rng(seed)
  const b: number[][] = []
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r() * 0.4
    b.push([Math.cos(a) * 2.3, 4.5 + r() * 0.5, Math.sin(a) * 2.3, 1.45 + r() * 0.35])
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + r()
    b.push([Math.cos(a) * 1.0, 5.2 + r() * 0.3, Math.sin(a) * 1.0, 1.6])
  }
  return b
}

function Branches({ seed, n, y, len, rad, tilt }: { seed: number; n: number; y: number; len: number; rad: number; tilt: number }) {
  const r = rng(seed + 7)
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + r() * 0.6
        const t = tilt + (r() - 0.5) * 0.2
        const dir = new THREE.Vector3(Math.sin(a) * Math.sin(t), Math.cos(t), Math.cos(a) * Math.sin(t))
        const p = dir.clone().multiplyScalar(len / 2).add(new THREE.Vector3(0, y, 0))
        return (
          <mesh
            key={i}
            geometry={cyl(rad * 0.55, rad, len, 10)}
            material={mat(C.TRUNK, { rough: 0.9, grade: false })}
            position={p}
            rotation={new THREE.Euler(t, a, 0, 'YXZ')}
            castShadow
          />
        )
      })}
    </>
  )
}

/** Rain tree — the great umbrella canopy that shades Bengaluru's streets. */
export function RainTree({ p, s = 1, seed, detail = 4 }: { p: V3; s?: number; seed: number; detail?: number }) {
  const geo = useMemo(
    () => canopyGeo(rainBlobs(seed), { seed, deep: C.LEAF_DEEP, mid: C.LEAF_MID, light: C.LEAF_LIGHT, detail }),
    [seed, detail],
  )
  return (
    <group position={p} scale={s}>
      <Cyl rt={0.3} rb={0.5} h={3.4} p={[0, 1.7, 0]} c={C.TRUNK} rough={0.9} />
      <Branches seed={seed} n={4} y={2.9} len={3.2} rad={0.24} tilt={0.75} />
      <mesh geometry={geo} material={leafMat()} castShadow receiveShadow />
    </group>
  )
}

/** Gulmohar — flame-orange blossoms over green. */
export function Gulmohar({ p, s = 1, seed }: { p: V3; s?: number; seed: number }) {
  const geo = useMemo(
    () =>
      canopyGeo(gulmoharBlobs(seed), {
        seed,
        deep: C.LEAF_DEEP,
        mid: C.LEAF_MID,
        light: C.LEAF_LIGHT,
        flower: C.FLAME,
        flowerAmt: 0.9,
      }),
    [seed],
  )
  return (
    <group position={p} scale={s}>
      <Cyl rt={0.2} rb={0.34} h={3.0} p={[0, 1.5, 0]} c={C.TRUNK} rough={0.9} />
      <Branches seed={seed} n={3} y={2.6} len={2.2} rad={0.16} tilt={0.85} />
      <mesh geometry={geo} material={leafMat()} castShadow receiveShadow />
    </group>
  )
}

export function Bush({ p, s = 1, seed, flower }: { p: V3; s?: number; seed: number; flower?: string }) {
  const geo = useMemo(() => {
    const r = rng(seed)
    const blobs = Array.from({ length: 4 }, (_, i) => {
      const a = (i / 4) * Math.PI * 2 + r()
      return [Math.cos(a) * 0.55, 0.15 + r() * 0.25, Math.sin(a) * 0.45, 0.55 + r() * 0.2]
    })
    blobs.push([0, 0.45, 0, 0.6])
    return canopyGeo(blobs, { seed, deep: C.LEAF_DEEP, mid: C.LEAF_MID, light: C.LEAF_LIGHT, flower, flowerAmt: 0.9, detail: 3 })
  }, [seed, flower])
  return <mesh geometry={geo} material={leafMat()} position={p} scale={s} castShadow receiveShadow />
}

export function StreetTrees() {
  return (
    <>
      {TREES.map((t) =>
        t.kind === 'rain' ? (
          <RainTree key={t.seed} p={[t.x, BASE, t.z]} s={t.s} seed={t.seed} />
        ) : (
          <Gulmohar key={t.seed} p={[t.x, BASE, t.z]} s={t.s} seed={t.seed} />
        ),
      )}
    </>
  )
}
