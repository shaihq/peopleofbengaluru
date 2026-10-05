'use client'

import * as THREE from 'three'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { C, UI } from '@/lib/palette'
import { BASE } from '../../layout'
import { mat, texMat } from '../../materials'
import { plane, rbox } from '../../geometry'
import { asphaltTex, fontVar, grassTex, paverTex, repeated, rng, stripeTex, useFontsReady } from '../../textures'
import { Box, Cyl, Door, Pot, Sign, Win } from '../../world/kit'
import { Building } from '../../world/Building'
import { CompoundWall } from '../../world/CompoundWall'
import { Bench, Railing } from '../../world/Park'
import { Scooter } from '../../world/Props'
import { ShopUnit } from '../../world/ShopRow'
import { Bush, Gulmohar, RainTree } from '../../world/Trees'
import { Background } from '../../world/Background'
import { StaticMerge } from '../../world/StaticMerge'
import { Portal } from '../../world/Portal'
import {
  BREW_LAB,
  BUNGALOWS,
  HSR_FILLERS,
  HSR_PORTAL,
  HSR_SHOPS,
  HSR_SHOP_Z,
  HSR_TREES,
  MAIN,
  MEDIAN,
  MEDIAN_GAP,
  MURAL,
  SECTOR_PARK,
  SHIP_CLUB,
  SIDE,
} from './layout'

const EXT = 120

// --- ground: 27th Main (two carriageways + median) and the sector road --------------

function slab(x0: number, x1: number, z0: number, z1: number, m: THREE.Material, y = BASE) {
  return <mesh geometry={rbox(x1 - x0, y, z1 - z0, 0.03)} material={m} position={[(x0 + x1) / 2, y / 2, (z0 + z1) / 2]} receiveShadow />
}

function HSRGround() {
  const road = texMat('asphalt', () => repeated(asphaltTex(), (EXT * 2) / 10, (EXT * 2) / 10), { rough: 0.92 })
  const walk = texMat('hsr-pavers', () => repeated(paverTex(), EXT, EXT), { rough: 0.9 })
  const grass = texMat('hsr-median', () => repeated(grassTex(), 60, 1), { rough: 0.95 })
  const paint = mat(C.ROAD_PAINT, { rough: 0.9, grade: false })
  const marks: [number, number, number, number, number][] = [] // x, z, w, l, rot
  for (let x = -EXT; x < EXT; x += 6) {
    if (Math.abs(x) < 10) continue
    marks.push([x, -4.85, 3, 0.16, 0], [x, 4.85, 3, 0.16, 0]) // lane dashes
  }
  for (let z = -14; z > -EXT; z -= 6) marks.push([0, z, 0.16, 3, 0]) // sector road centre line
  for (let i = -3; i <= 3; i++) {
    // zebra across the sector road mouth
    marks.push([i * 1.2, -10.4, 0.6, 2.6, 0])
  }
  for (const s of [-1, 1])
    for (let i = 0; i < 6; i++) {
      // zebras across both carriageways, either side of the junction
      marks.push([s * 9, -7.6 + i * 1.25, 2.6, 0.6, 0], [s * 9, 1.9 + i * 1.25, 2.6, 0.6, 0])
    }
  return (
    <>
      <mesh geometry={plane(1400, 1400)} material={mat('#B9AD8A', { grade: false })} position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh geometry={plane(EXT * 2, EXT * 2)} material={road} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
      {slab(-EXT, EXT, MAIN, EXT, walk)}
      {slab(-EXT, -SIDE, -EXT, -MAIN, walk)}
      {slab(SIDE, EXT, -EXT, -MAIN, walk)}
      {/* median planter: low kerbed bed of grass */}
      {slab(-EXT, -MEDIAN_GAP, -MEDIAN, MEDIAN, mat(C.CONCRETE_WARM), BASE + 0.05)}
      {slab(MEDIAN_GAP, EXT, -MEDIAN, MEDIAN, mat(C.CONCRETE_WARM), BASE + 0.05)}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={plane(EXT - MEDIAN_GAP, MEDIAN * 2 - 0.4)} material={grass} position={[s * (EXT + MEDIAN_GAP) / 2, BASE + 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
      ))}
      {marks.map(([x, z, w, l, r], i) => (
        <mesh key={i} geometry={plane(w, l)} material={paint} position={[x, 0.012, z]} rotation={[-Math.PI / 2, 0, r]} receiveShadow />
      ))}
    </>
  )
}

/** Black-and-yellow painted kerbs along a list of straight runs. */
function KerbLines({ runs }: { runs: [number, number, number, number][] }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const segs = useMemo(() => {
    const out: { x: number; z: number; rot: number; yellow: boolean }[] = []
    for (const [x0, z0, x1, z1] of runs) {
      const len = Math.hypot(x1 - x0, z1 - z0)
      const n = Math.floor(len)
      const rot = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n
        out.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, rot, yellow: k % 2 === 0 })
      }
    }
    return out
  }, [runs])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75 }), [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const yellow = new THREE.Color(C.KERB_YELLOW)
    const black = new THREE.Color(C.KERB_BLACK)
    segs.forEach((s, i) => {
      m.makeRotationY(s.rot).setPosition(s.x, 0.12, s.z)
      ref.current.setMatrixAt(i, m)
      ref.current.setColorAt(i, s.yellow ? yellow : black)
    })
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
  }, [segs])
  // 0.30 deep around a centre 0.13 from the pavement edge: the road face stands 2 cm proud
  // of the slab's edge instead of sharing its plane (which z-fought along every kerb)
  return <instancedMesh ref={ref} args={[rbox(0.96, 0.24, 0.3), material, segs.length]} castShadow receiveShadow />
}

const KERBS: [number, number, number, number][] = [
  [-60, MAIN + 0.13, 60, MAIN + 0.13],
  [-60, -MAIN - 0.13, -SIDE, -MAIN - 0.13],
  [SIDE, -MAIN - 0.13, 60, -MAIN - 0.13],
  [-SIDE - 0.13, -MAIN, -SIDE - 0.13, -60],
  [SIDE + 0.13, -MAIN, SIDE + 0.13, -60],
  [-60, MEDIAN + 0.13, -MEDIAN_GAP, MEDIAN + 0.13],
  [-60, -MEDIAN - 0.13, -MEDIAN_GAP, -MEDIAN - 0.13],
  [MEDIAN_GAP, MEDIAN + 0.13, 60, MEDIAN + 0.13],
  [MEDIAN_GAP, -MEDIAN - 0.13, 60, -MEDIAN - 0.13],
]

// --- Brew Lab: specialty coffee with a terrace ----------------------------------------

function BrewLab() {
  const { x, z, w, d } = BREW_LAB
  const umbrella = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: repeated(stripeTex(C.WALL_WHITE, C.TERRACOTTA), 6, 1), roughness: 0.85, side: THREE.DoubleSide })
    return { m, g: new THREE.CylinderGeometry(0.05, 1.25, 0.45, 24, 1, true) }
  }, [])
  const G = 4.4
  return (
    <>
      {/* local +Z faces the avenue (−Z world), so rotate π */}
      <group position={[x, BASE, z + d / 2]} rotation={[0, Math.PI, 0]}>
        <Box s={[w, G, d]} p={[0, G / 2, 0]} c={C.WALL_WHITE} />
        <Box s={[w + 0.1, 1.3, d + 0.1]} p={[0, 0.65, 0]} c={C.TERRACOTTA} />
        {/* tall glass front */}
        {[-3.6, 0, 3.6].map((wx) => (
          <Win key={wx} p={[wx, 2.1, d / 2]} w={3.1} h={2.5} frame="#2B2F45" shade={false} />
        ))}
        <Door p={[5.2, 0, d / 2]} w={1.0} c="#2B2F45" frame="#2B2F45" />
        {/* deep ink canopy */}
        <Box s={[w + 0.6, 0.2, 1.8]} p={[0, G - 0.2, d / 2 + 0.85]} c="#2B2F45" rough={0.5} />
        <Sign
          p={[0, G + 0.55, d / 2 + 0.1]}
          w={6.4}
          h={1.05}
          spec={{ title: 'BREW LAB', kn: 'ಬ್ರೂ ಲ್ಯಾಬ್', sub: 'SPECIALTY COFFEE · ROASTED IN BENGALURU', bg: '#2B2F45', fg: C.WALL_BUTTER }}
          frame={C.TERRACOTTA}
        />
        <Box s={[w + 0.24, 0.22, d + 0.24]} p={[0, G + 0.02, 0]} c={C.TERRACOTTA} />
        <Pot p={[-5.4, 0, d / 2 + 0.5]} s={1.4} />
        <Pot p={[4.1, 0, d / 2 + 0.5]} s={1.2} />
      </group>
      {/* terrace: round tables under striped umbrellas */}
      {[-38, -34, -30].map((tx) => (
        <group key={tx} position={[tx, BASE, 10.2]}>
          <Cyl rt={0.42} h={0.05} p={[0, 0.76, 0]} c={C.WALL_WHITE} rough={0.5} grade={false} />
          <Cyl rt={0.05} h={0.74} p={[0, 0.37, 0]} c="#2B2F45" metal={0.4} rough={0.5} grade={false} />
          <Cyl rt={0.03} h={2.1} p={[0, 1.05, 0]} c="#2B2F45" metal={0.4} rough={0.5} grade={false} />
          <mesh geometry={umbrella.g} material={umbrella.m} position={[0, 2.2, 0]} castShadow receiveShadow />
          {[0, 2.1, 4.2].map((a) => (
            <Cyl key={a} rt={0.17} h={0.45} p={[Math.sin(a) * 0.75, 0.225, Math.cos(a) * 0.75]} c={C.WOOD} rough={0.7} />
          ))}
        </group>
      ))}
    </>
  )
}

// --- Ship Club: the co-working space where people build in public ---------------------

function ShipClub() {
  const { x, z, w, d } = SHIP_CLUB
  const FH = 3.4
  const TEAL = '#1F8A70'
  return (
    <>
      <group position={[x, BASE, z + d / 2]} rotation={[0, Math.PI, 0]}>
        <Box s={[w, FH * 3, d]} p={[0, (FH * 3) / 2, 0]} c={C.WALL_WHITE} />
        {/* glass ground floor */}
        {[-5.4, -1.8, 1.8, 5.4].map((wx) => (
          <Win key={wx} p={[wx, 1.6, d / 2]} w={3.2} h={2.6} frame="#2B2F45" shade={false} />
        ))}
        {/* ribbon windows + teal fins on the upper floors */}
        {[1, 2].map((f) => (
          <group key={f}>
            <Box s={[w + 0.2, 0.24, d + 0.2]} p={[0, f * FH, 0]} c={C.CONCRETE_WARM} />
            {[-4.8, 0, 4.8].map((wx) => (
              <Win key={wx} p={[wx, f * FH + 1.7, d / 2]} w={4.2} h={1.6} frame="#2B2F45" shade={false} />
            ))}
          </group>
        ))}
        {[-7.4, -2.4, 2.4, 7.4].map((fx) => (
          <Box key={fx} s={[0.35, FH * 2 - 0.4, 0.7]} p={[fx, FH + (FH * 2) / 2, d / 2 + 0.35]} c={TEAL} />
        ))}
        {/* solar panels on the roof */}
        {[-5, -1.6, 1.8, 5.2].map((sx) => (
          <group key={sx} position={[sx, FH * 3 + 0.5, -1]} rotation={[-0.45, 0, 0]}>
            <Box s={[3, 0.08, 1.9]} c="#24365A" rough={0.25} metal={0.5} grade={false} />
          </group>
        ))}
        <Box s={[w + 0.3, 0.6, d + 0.3]} p={[0, FH * 3 + 0.3, 0]} c={C.WALL_WHITE} grade={false} />
        {/* fascia + vertical blade sign */}
        <Sign
          p={[0, FH - 0.55, d / 2 + 0.12]}
          w={9}
          h={0.9}
          spec={{ title: 'SHIP CLUB', kn: 'ಶಿಪ್ ಕ್ಲಬ್', sub: 'CO-WORKING FOR BUILDERS · OPEN 24/7', bg: TEAL, fg: '#FFF6E5' }}
          frame={C.WALL_WHITE}
        />
        <group position={[w / 2 + 0.25, FH * 2, d / 2 - 0.4]} rotation={[0, Math.PI / 2, 0]}>
          <Sign p={[0, 0, 0]} w={4.6} h={1.1} spec={{ title: 'BUILD · SHIP · REPEAT', bg: '#2B2F45', fg: UI.SAFFRON }} frame={TEAL} />
        </group>
        <Door p={[-7.2, 0, d / 2]} w={1.2} h={2.4} c={TEAL} frame="#2B2F45" />
      </group>
      {/* timber deck out front: planters, bike rack and the demo-night board */}
      <Box s={[w - 2, 0.12, 2.6]} p={[x, BASE + 0.06, 11.4]} c={C.WOOD} rough={0.75} />
      {[-22.4, -9.6].map((px) => (
        <group key={px} position={[px, BASE, 11.1]}>
          <Box s={[1, 0.7, 1]} p={[0, 0.35, 0]} c={C.CONCRETE_AGED} />
          <Bush p={[0, 0.9, 0]} s={0.75} seed={Math.round(px * -7)} />
        </group>
      ))}
      {[-18, -17.2, -16.4].map((bx) => (
        <mesh key={bx} position={[bx, BASE + 0.45, 10.2]} rotation={[0, Math.PI / 2, 0]} castShadow>
          <torusGeometry args={[0.38, 0.04, 8, 20, Math.PI]} />
          <meshStandardMaterial color={C.STEEL} metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      <group position={[-12.5, BASE, 10.2]} rotation={[0, 0.25, 0]}>
        <group rotation={[-0.18, 0, 0]}>
          <Sign p={[0, 0.65, 0]} w={0.8} h={1.0} spec={{ title: 'DEMO NIGHT', sub: 'FRI · 7 PM · ALL WELCOME', bg: '#2F4A3A', fg: '#FFF6E5' }} frame={C.WOOD} depth={0.05} />
        </group>
      </group>
      <Scooter x={-14.6} z={9.4} rot={Math.PI / 2} color={TEAL} />
    </>
  )
}

// --- The mural wall: HSR's signature ---------------------------------------------------

function muralTexture(width: number, height: number) {
  const W = 2048
  const H = Math.round((W * height) / width)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const r = rng(77)
  g.fillStyle = C.WALL_WHITE
  g.fillRect(0, 0, W, H)
  // big hand-painted shapes in the palette
  const blocks = [C.FLAME, C.KERB_YELLOW, '#1F8A70', C.WALL_POWDER, C.WALL_PINK, C.TERRACOTTA, C.BMTC_BLUE]
  for (let i = 0; i < 9; i++) {
    g.fillStyle = blocks[i % blocks.length]
    const x = (i / 9) * W + r() * 40
    g.beginPath()
    if (i % 3 === 0) g.arc(x + 90, H * (0.3 + r() * 0.4), H * (0.28 + r() * 0.14), 0, Math.PI * 2)
    else if (i % 3 === 1) {
      g.moveTo(x, H)
      g.lineTo(x + 140 + r() * 80, H * (0.1 + r() * 0.2))
      g.lineTo(x + 300, H)
    } else g.rect(x, H * 0.15, 120 + r() * 60, H * 0.7)
    g.fill()
  }
  // waves along the bottom
  g.strokeStyle = '#2B2F45'
  g.lineWidth = 10
  for (let k = 0; k < 2; k++) {
    g.beginPath()
    for (let x = 0; x <= W; x += 8) g.lineTo(x, H * (0.86 + k * 0.07) + Math.sin(x / 38 + k) * 9)
    g.stroke()
  }
  // the words — placed on the wall panels either side of the park gate (never across the opening)
  const span = MURAL.x1 - MURAL.x0
  const leftMid = ((MURAL.x0 + MURAL.gate[0]) / 2 - MURAL.x0) / span
  const rightMid = ((MURAL.gate[1] + MURAL.x1) / 2 - MURAL.x0) / span
  const display = fontVar('--font-display')
  const kn = fontVar('--font-kannada')
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const fit = (text: string, size: number, maxW: number, font: (s: number) => string) => {
    g.font = font(size)
    const w = g.measureText(text).width
    if (w > maxW) g.font = font((size * maxW) / w)
  }
  const panelW = ((MURAL.gate[0] - MURAL.x0) / span) * W * 0.9
  fit('BUILD IN PUBLIC', H * 0.4, panelW, (sz) => `italic 800 ${sz}px ${display}`)
  g.lineWidth = H * 0.05
  g.strokeStyle = '#2B2F45'
  g.strokeText('BUILD IN PUBLIC', W * leftMid, H * 0.44)
  g.fillStyle = '#FFF6E5'
  g.fillText('BUILD IN PUBLIC', W * leftMid, H * 0.44)
  fit('ಕಟ್ಟು · ಹಂಚು · ಬೆಳೆ', H * 0.26, ((MURAL.x1 - MURAL.gate[1]) / span) * W * 0.85, (sz) => `700 ${sz}px ${kn}`)
  g.lineWidth = H * 0.035
  g.strokeStyle = '#FFF6E5'
  g.strokeText('ಕಟ್ಟು · ಹಂಚು · ಬೆಳೆ', W * rightMid, H * 0.42)
  g.fillStyle = '#2B2F45'
  g.fillText('ಕಟ್ಟು · ಹಂಚು · ಬೆಳೆ', W * rightMid, H * 0.42)
  g.font = `italic 800 ${H * 0.11}px ${display}`
  g.fillText('BUILD · SHARE · GROW', W * rightMid, H * 0.7)
  // painted speckle so it reads as paint, not print
  for (let i = 0; i < 6000; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'
    g.fillRect(r() * W, r() * H, 2 + r() * 4, 2 + r() * 4)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function MuralWall() {
  useFontsReady()
  const HGT = 2.7
  const [g0, g1] = MURAL.gate
  const left = g0 - MURAL.x0
  const right = MURAL.x1 - g1
  const m = useMemo(() => {
    const t = muralTexture(MURAL.x1 - MURAL.x0, HGT)
    return { t, left: new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }), right: new THREE.MeshStandardMaterial({ map: t.clone(), roughness: 0.85 }) }
  }, [])
  useMemo(() => {
    const span = MURAL.x1 - MURAL.x0
    m.left.map!.repeat.set(left / span, 1)
    m.right.map!.repeat.set(right / span, 1)
    m.right.map!.offset.set((g1 - MURAL.x0) / span, 0)
    m.right.map!.needsUpdate = true
  }, [m, left, right, g1])
  return (
    <group position={[0, BASE, MURAL.z]}>
      {[
        [MURAL.x0, g0, m.left],
        [g1, MURAL.x1, m.right],
      ].map(([a, b, mm], i) => {
        const x0 = a as number
        const x1 = b as number
        return (
          <group key={i}>
            <Box s={[x1 - x0, HGT, 0.3]} p={[(x0 + x1) / 2, HGT / 2, 0]} c={C.WALL_WHITE} />
            <Box s={[x1 - x0 + 0.1, 0.14, 0.42]} p={[(x0 + x1) / 2, HGT + 0.07, 0]} c={C.TERRACOTTA} />
            {/* mural faces the avenue (−Z) */}
            <mesh position={[(x0 + x1) / 2, HGT / 2, -0.16]} rotation={[0, Math.PI, 0]} material={mm as THREE.Material} receiveShadow>
              <planeGeometry args={[x1 - x0, HGT - 0.1]} />
            </mesh>
          </group>
        )
      })}
      {/* gate pillars into the park */}
      {[g0, g1].map((gx) => (
        <group key={gx} position={[gx, 0, 0]}>
          <Box s={[0.6, 3.1, 0.6]} p={[0, 1.55, 0]} c={C.WALL_WHITE} />
          <Box s={[0.75, 0.14, 0.75]} p={[0, 3.15, 0]} c="#1F8A70" />
        </group>
      ))}
    </group>
  )
}

function SectorPark() {
  const { x0, x1, z0, z1 } = SECTOR_PARK
  const lawn = texMat('hsr-lawn', () => repeated(grassTex(), (x1 - x0) / 4, (z1 - z0) / 4), { rough: 0.95 })
  const path = { c: C.PATH, rough: 0.9, grade: false, shadow: false }
  return (
    <>
      <Box s={[x1 - x0 - 0.3, 0.06, z1 - z0 - 0.3]} p={[(x0 + x1) / 2, BASE + 0.03, (z0 + z1) / 2]} material={lawn} shadow={false} />
      {/* path from the mural gate, looping round the big rain tree */}
      <Box s={[1.6, 0.05, 6]} p={[27.5, BASE + 0.07, 15.4]} {...path} />
      <Box s={[16, 0.05, 1.6]} p={[27.5, BASE + 0.07, 18.4]} {...path} />
      <Box s={[1.6, 0.05, 12]} p={[19.5, BASE + 0.07, 24.4]} {...path} />
      <Box s={[1.6, 0.05, 12]} p={[35.5, BASE + 0.07, 24.4]} {...path} />
      <Box s={[17.6, 0.05, 1.6]} p={[27.5, BASE + 0.07, 30.4]} {...path} />
      <Railing from={[x0, z0]} to={[x0, z1]} />
      <Railing from={[x0, z1]} to={[x1, z1]} />
      <Railing from={[x1, z0]} to={[x1, z1]} />
      <Bench p={[19, 18]} />
      <Bench p={[36, 26]} rot={Math.PI / 2} />
      <Bench p={[24, 31]} rot={Math.PI} />
      <Bush p={[16, BASE + 0.2, 32]} s={1.3} seed={511} flower={C.BOUGAIN} />
      <Bush p={[39, BASE + 0.2, 32]} s={1.2} seed={512} />
      <Bush p={[39, BASE + 0.2, 15]} s={1.0} seed={513} />
    </>
  )
}

/** An independent house behind a compound wall with a gate and a bougainvillea. */
function Bungalow(b: (typeof BUNGALOWS)[number]) {
  const front = b.rot === 0
  const wallAt = front ? b.z + b.d / 2 + 2.4 : b.x + b.d / 2 + 2.4
  const span = (front ? [b.x - b.w / 2 - 1, b.x + b.w / 2 + 1] : [b.z - b.w / 2 - 1, b.z + b.w / 2 + 1]) as [number, number]
  const seg = (a: number, c: number): [[number, number], [number, number]] => (front ? [[a, wallAt], [c, wallAt]] : [[wallAt, a], [wallAt, c]])
  const [l0, l1] = seg(span[0], b.gate - 1.3)
  const [r0, r1] = seg(b.gate + 1.3, span[1])
  const gp = (v: number): [number, number, number] => (front ? [v, BASE, wallAt] : [wallAt, BASE, v])
  return (
    <>
      <Building {...b} />
      <CompoundWall from={l0} to={l1} wall={C.WALL_WHITE} cap={b.accent ?? C.TERRACOTTA} />
      <CompoundWall from={r0} to={r1} wall={C.WALL_WHITE} cap={b.accent ?? C.TERRACOTTA} />
      {[b.gate - 1.3, b.gate + 1.3].map((v) => (
        <group key={v} position={gp(v)}>
          <Box s={[0.55, 1.9, 0.55]} p={[0, 0.95, 0]} c={C.WALL_WHITE} />
          <Box s={[0.7, 0.14, 0.7]} p={[0, 1.95, 0]} c={b.accent ?? C.TERRACOTTA} />
        </group>
      ))}
      <Bush p={front ? [span[0] + 1.2, BASE + 1.3, wallAt + 0.3] : [wallAt + 0.3, BASE + 1.3, span[0] + 1.2]} s={1.15} seed={b.seed + 7} flower={C.BOUGAIN} />
    </>
  )
}

export function HSRWorld() {
  return (
    <>
      <StaticMerge>
        <HSRGround />
        <BrewLab />
        <ShipClub />
        <MuralWall />
        <SectorPark />
        {HSR_SHOPS.map((s) => (
          <group key={s.x} position={[0, 0, 0]}>
            <ShopUnit {...s} z={HSR_SHOP_Z} />
          </group>
        ))}
        {BUNGALOWS.map((b) => (
          <Bungalow key={b.seed} {...b} />
        ))}
        {HSR_FILLERS.map((b) => (
          <Building key={b.seed} {...b} />
        ))}
        {HSR_TREES.map((t) =>
          t.kind === 'rain' ? <RainTree key={t.seed} p={[t.x, BASE, t.z]} s={t.s} seed={t.seed} /> : <Gulmohar key={t.seed} p={[t.x, BASE + 0.05, t.z]} s={t.s} seed={t.seed} />,
        )}
        <Scooter x={-31} z={-9.8} rot={Math.PI / 2} color={C.WALL_POWDER} />
        <Scooter x={19.6} z={-10} rot={Math.PI + 0.1} color={C.FLAME} />
        <Background seed={131} metro={66} />
      </StaticMerge>
      <KerbLines runs={KERBS} />
      <Portal pose={HSR_PORTAL} />
    </>
  )
}
