'use client'

import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { C } from '@/lib/palette'
import { BASE, POLE_RUNS } from '../layout'
import { lampMat, lights, mat } from '../materials'
import { Box } from './kit'

const POLE = '#BDB2A0'
const TOP = 8.4
const ARM = 7.7

/** Concrete electric pole with crossarm, street-lamp arm and the odd transformer. */
function Pole({ x, z, ax, az, transformer }: { x: number; z: number; ax: number; az: number; transformer?: boolean }) {
  const yaw = Math.atan2(ax, az)
  return (
    <group position={[x, BASE, z]} rotation={[0, yaw, 0]}>
      <Box s={[0.28, TOP, 0.28]} p={[0, TOP / 2, 0]} c={POLE} />
      <Box s={[1.5, 0.14, 0.14]} p={[0, ARM, 0]} c={POLE} />
      {/* lamp arm reaching over the road */}
      <Box s={[0.1, 0.1, 1.9]} p={[0, 7.0, 0.95]} c={C.GRILLE} metal={0.4} rough={0.5} grade={false} />
      <Box s={[0.34, 0.14, 0.6]} p={[0, 6.92, 1.95]} material={lampMat()} />
      {/* the pool of light it throws on the road at night */}
      <mesh geometry={poolGeo} material={poolMat} position={[0, 0.02 - BASE, 1.95]} rotation={[-Math.PI / 2, 0, 0]} userData={{ noMerge: true }} />
      {transformer && (
        <group position={[0, 5.2, -0.42]}>
          <Box s={[0.9, 1.1, 0.55]} p={[0, 0, 0]} c="#8E98A3" metal={0.3} rough={0.5} grade={false} />
          {[-0.3, 0, 0.3].map((fx) => (
            <Box key={fx} s={[0.08, 0.9, 0.2]} p={[fx, 0, -0.35]} c="#7D8791" metal={0.3} rough={0.5} grade={false} shadow={false} />
          ))}
        </group>
      )}
    </group>
  )
}

// Lamp light on the ground: a soft warm disc, added on top of the road (no real lights: dozens of
// point lights would cost more than the whole city). Fades in with the night.
const poolGeo = new THREE.CircleGeometry(4.2, 40)
const poolTex = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()
const poolMat = new THREE.MeshBasicMaterial({
  color: '#FFD494',
  map: poolTex,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -4,
  fog: false,
})

/** Lamps on with the dusk, off with the dawn. */
function LampsOn() {
  const was = useRef(-1)
  useFrame(() => {
    const on = lights.value
    if (on === was.current) return
    was.current = on
    lampMat().emissiveIntensity = on * 7
    poolMat.opacity = on * 0.32
    poolMat.visible = on > 0
  })
  return null
}

function sagCurve(a: THREE.Vector3, b: THREE.Vector3, sag: number) {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 10; i++) {
    const t = i / 10
    const p = a.clone().lerp(b, t)
    p.y -= sag * 4 * t * (1 - t)
    pts.push(p)
  }
  return new THREE.CatmullRomCurve3(pts)
}

function Cables() {
  const geos = useMemo(() => {
    const out: THREE.BufferGeometry[] = []
    for (const run of POLE_RUNS) {
      for (let i = 0; i < run.length - 1; i++) {
        const [x0, z0, ax, az] = run[i]
        const [x1, z1] = run[i + 1]
        // crossarm runs perpendicular to the lamp arm
        const px = az
        const pz = -ax
        for (const [off, y, sag] of [
          [0.62, BASE + ARM + 0.08, 0.7],
          [-0.62, BASE + ARM + 0.08, 0.85],
          [0, BASE + TOP - 0.1, 0.55],
        ] as const) {
          const a = new THREE.Vector3(x0 + px * off, y, z0 + pz * off)
          const b = new THREE.Vector3(x1 + px * off, y, z1 + pz * off)
          out.push(new THREE.TubeGeometry(sagCurve(a, b, sag), 20, 0.028, 5, false))
        }
      }
    }
    return out
  }, [])
  const m = mat('#2A2C33', { rough: 0.6, grade: false })
  return (
    <>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={m} castShadow />
      ))}
    </>
  )
}

export function StreetPoles() {
  return (
    <>
      {POLE_RUNS.flatMap((run, ri) =>
        run.map(([x, z, ax, az], i) => <Pole key={`${ri}-${i}`} x={x} z={z} ax={ax} az={az} transformer={(ri + i) % 4 === 1} />),
      )}
      <Cables />
      <LampsOn />
    </>
  )
}
