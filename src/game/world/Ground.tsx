'use client'

import * as THREE from 'three'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { C } from '@/lib/palette'
import { BASE, ROAD } from '../layout'
import { mat, texMat } from '../materials'
import { plane, rbox } from '../geometry'
import { asphaltTex, paverTex, repeated } from '../textures'

const EXTENT = 120
const paint = () => mat(C.ROAD_PAINT, { rough: 0.9, grade: false })

function Mark({ x, z, w, l, rot = 0 }: { x: number; z: number; w: number; l: number; rot?: number }) {
  return <mesh geometry={plane(w, l)} material={paint()} position={[x, 0.012, z]} rotation={[-Math.PI / 2, 0, rot]} receiveShadow />
}

function RoadMarkings() {
  const marks: { x: number; z: number; w: number; l: number; rot?: number }[] = []
  // centre dashes
  for (let d = 10; d < EXTENT; d += 6) {
    for (const s of [1, -1]) {
      marks.push({ x: 0, z: s * d, w: 0.16, l: 3 })
      marks.push({ x: s * d, z: 0, w: 0.16, l: 3, rot: Math.PI / 2 })
    }
  }
  // zebra crossings + stop lines on all four approaches
  for (const s of [1, -1]) {
    for (let i = -4; i <= 4; i++) {
      marks.push({ x: i * 1.05, z: s * 7.7, w: 0.55, l: 2.8 })
      marks.push({ x: s * 7.7, z: i * 1.05, w: 0.55, l: 2.8, rot: Math.PI / 2 })
    }
    marks.push({ x: -s * 2.5, z: s * 9.7, w: 4.6, l: 0.3 })
    marks.push({ x: s * 9.7, z: s * 2.5, w: 0.3, l: 4.6 })
  }
  return (
    <>
      {marks.map((m, i) => (
        <Mark key={i} {...m} />
      ))}
    </>
  )
}

/** Patched asphalt — every Bengaluru road has a few. */
function Patches() {
  const m = mat('#3E3F46', { rough: 0.95, grade: false })
  return (
    <>
      {[
        [2.2, 16, 1.8, 1.2, 0.3],
        [-1.8, -21, 2.4, 1.4, -0.2],
        [17, -1.6, 1.5, 2.0, 0.1],
        [-23, 2.1, 2.0, 1.1, 0.4],
      ].map(([x, z, w, l, r], i) => (
        <mesh key={i} geometry={plane(w, l)} material={m} position={[x, 0.006, z]} rotation={[-Math.PI / 2, 0, r]} receiveShadow />
      ))}
    </>
  )
}

export function Ground() {
  const road = texMat('asphalt', () => repeated(asphaltTex(), (EXTENT * 2) / 10, (EXTENT * 2) / 10), { rough: 0.92 })
  const slabSize = EXTENT - ROAD
  const walk = texMat('pavers', () => repeated(paverTex(), slabSize, slabSize), { rough: 0.9 })
  const c = ROAD + slabSize / 2
  return (
    <>
      <mesh geometry={plane(1400, 1400)} material={mat('#B9AD8A', { grade: false })} position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh geometry={plane(EXTENT * 2, EXTENT * 2)} material={road} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
      {[
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ].map(([sx, sz]) => (
        <mesh
          key={`${sx}${sz}`}
          geometry={rbox(slabSize, BASE, slabSize, 0.03)}
          material={walk}
          position={[sx * c, BASE / 2, sz * c]}
          receiveShadow
        />
      ))}
      <RoadMarkings />
      <Patches />
    </>
  )
}

/** Black-and-yellow painted kerbs — instanced, kept out of the static merge. */
export function Kerbs() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const segs = Math.floor(EXTENT - ROAD)
  const count = segs * 8
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75 }), [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const yellow = new THREE.Color(C.KERB_YELLOW)
    const black = new THREE.Color(C.KERB_BLACK)
    let i = 0
    for (const sx of [1, -1])
      for (const sz of [1, -1])
        for (let k = 0; k < segs; k++) {
          const along = ROAD + 0.5 + k
          const col = k % 2 ? black : yellow
          m.setPosition(sx * along, 0.12, sz * (ROAD - 0.13))
          ref.current.setMatrixAt(i, m)
          ref.current.setColorAt(i++, col)
          m.makeRotationY(Math.PI / 2).setPosition(sx * (ROAD - 0.13), 0.12, sz * along)
          ref.current.setMatrixAt(i, m)
          ref.current.setColorAt(i++, col)
          m.identity()
        }
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
  }, [segs])
  return <instancedMesh ref={ref} args={[rbox(0.96, 0.24, 0.26), material, count]} castShadow receiveShadow />
}
