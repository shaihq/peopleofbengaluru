'use client'

import * as THREE from 'three'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Avatar, type AvatarState } from '../characters/Avatar'
import { groundHeight } from '../layout'
import { rayDistance } from '../player/collision'
import { useGame } from '../store'
import { bodies, player } from './bodies'
import { plates, type Lod } from './plates'
import type { Profile } from './profiles'

const WALK = 1.35
const PLATE_Y = 2.2

// Nameplate detail by distance (design.md §10.5)
const NEAR = 11
const MID = 22
const FAR = 38

function dampAngle(a: number, b: number, rate: number, dt: number) {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * (1 - Math.exp(-rate * dt))
}

function Nameplate({ p, plate }: { p: Profile; plate: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={plate} className="np" data-lod="off">
      {p.openToWork && (
        <div className="np-open">
          <span className="np-dot" /> OPEN TO WORK
        </div>
      )}
      <div className="np-name">{p.name}</div>
      <div className="np-role">
        {p.role}
        {p.company && p.company !== 'Freelance' && p.company !== 'Solo' ? ` · ${p.company}` : ''}
      </div>
      {p.building && (
        <div className="np-building">
          <b>BUILDING</b> {p.building}
        </div>
      )}
      <div className="np-caret" />
    </div>
  )
}

/** A real (well — sample) person living in the district: character + nameplate + routine. */
export function Person({ p }: { p: Profile }) {
  const root = useRef<THREE.Group>(null!)
  const plate = useRef<HTMLDivElement>(null)
  const avatar = useRef<AvatarState>({ mode: 'idle', speed: 0, waveUntil: 0 })
  const camera = useThree((s) => s.camera)
  const start = p.spot ? [p.spot.x, p.spot.z] : p.path![0]
  const st = useRef({
    pos: new THREE.Vector3(start[0], 0, start[1]),
    facing: p.spot?.face ?? 0,
    wp: 1 % (p.path?.length ?? 1),
    wait: Math.random() * 2,
    occT: Math.random() * 0.2,
    occluded: false,
    engaged: false,
  })
  const ring = useRef<THREE.Mesh>(null!)
  const marker = useRef<THREE.Group>(null!)
  const markerMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#FFB020', depthTest: false, transparent: true, toneMapped: false }),
    [],
  )
  const markerEdge = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#1C1F2B', depthTest: false, transparent: true, toneMapped: false, side: THREE.BackSide }),
    [],
  )
  const ringMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#FFB020', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    [],
  )
  const tmp = useMemo(() => ({ head: new THREE.Vector3(), dir: new THREE.Vector3(), scr: new THREE.Vector3() }), [])

  useEffect(() => {
    bodies.set(p.id, st.current.pos)
    return () => {
      bodies.delete(p.id)
      plates.delete(p.id)
    }
  }, [p.id])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const s = st.current

    // --- engaged with the player? stop, turn to them, say hi ---------------
    const g = useGame.getState()
    const tracked = g.trackId === p.id
    const engaged = g.focusId === p.id || g.openId === p.id || (tracked && g.trackStage === 'found')
    if (engaged && !s.engaged) avatar.current.waveUntil = performance.now() + 1900
    s.engaged = engaged

    // --- routine ---------------------------------------------------------
    let speed = 0
    if (engaged && player.pos) {
      s.facing = dampAngle(s.facing, Math.atan2(player.pos.x - s.pos.x, player.pos.z - s.pos.z), 7, dt)
    } else if (p.path) {
      const [tx, tz] = p.path[s.wp]
      const dx = tx - s.pos.x
      const dz = tz - s.pos.z
      const dist = Math.hypot(dx, dz)
      if (s.wait > 0) s.wait -= dt
      else if (dist < 0.12) {
        s.wp = (s.wp + 1) % p.path.length
        s.wait = p.pause ?? 1.2
      } else {
        speed = WALK
        const step = Math.min(dist, WALK * dt)
        s.pos.x += (dx / dist) * step
        s.pos.z += (dz / dist) * step
        s.facing = dampAngle(s.facing, Math.atan2(dx, dz), 8, dt)
      }
    } else if (p.spot) {
      s.facing = dampAngle(s.facing, p.spot.face, 4, dt)
    }
    s.pos.y = THREE.MathUtils.damp(s.pos.y, groundHeight(s.pos.x, s.pos.z), 20, dt)
    root.current.position.copy(s.pos)
    root.current.rotation.y = s.facing
    avatar.current.speed = speed
    avatar.current.mode = speed > 0.1 ? 'walk' : 'idle'

    // highlight ring
    const t = performance.now() / 1000
    ringMat.opacity = THREE.MathUtils.damp(ringMat.opacity, engaged || tracked ? 0.85 : 0, 10, dt)

    // quest marker — visible through walls while you're tracking them
    marker.current.visible = tracked
    if (tracked) {
      marker.current.position.y = 3.05 + Math.sin(t * 3) * 0.12
      marker.current.rotation.y = t * 1.6
      const d = camera.position.distanceTo(s.pos)
      marker.current.scale.setScalar(THREE.MathUtils.clamp(d / 14, 0.8, 3))
    }
    ring.current.visible = ringMat.opacity > 0.01
    ring.current.scale.setScalar(1 + Math.sin(t * 4) * 0.06)
    ring.current.rotation.z = t * 0.6

    // --- nameplate LOD + cheap occlusion against the city's colliders -----
    const el = plate.current
    if (!el) return
    const playing = useGame.getState().phase === 'play'
    tmp.head.set(s.pos.x, s.pos.y + 1.6, s.pos.z)
    const d = camera.position.distanceTo(tmp.head)
    s.occT -= dt
    if (s.occT <= 0) {
      s.occT = 0.2
      tmp.dir.subVectors(tmp.head, camera.position).normalize()
      s.occluded = rayDistance(camera.position, tmp.dir, d) < d - 0.6
    }
    const want: Lod = !playing || g.openId || g.searchOpen || s.occluded || d > FAR ? 'off' : d < NEAR ? 'near' : d < MID ? 'mid' : 'far'
    tmp.scr.set(s.pos.x, s.pos.y + PLATE_Y, s.pos.z).project(camera)
    // hand off to the declutter pass in <People/>
    const req = plates.get(p.id)
    if (req) Object.assign(req, { el, d, want, x: tmp.scr.x, y: tmp.scr.y, behind: tmp.scr.z > 1 })
    else plates.set(p.id, { el, d, want, x: tmp.scr.x, y: tmp.scr.y, behind: tmp.scr.z > 1, shown: 'off' })
  })

  return (
    <group ref={root}>
      <Suspense fallback={null}>
        <Avatar id={p.character} state={avatar} />
      </Suspense>
      <mesh ref={ring} material={ringMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} renderOrder={2} visible={false}>
        <ringGeometry args={[0.55, 0.68, 40, 1, 0, Math.PI * 1.7]} />
      </mesh>
      <group ref={marker} visible={false} renderOrder={10}>
        <mesh material={markerEdge} scale={[1.3, 1.9, 1.3]} renderOrder={10}>
          <octahedronGeometry args={[0.26, 0]} />
        </mesh>
        <mesh material={markerMat} scale={[1, 1.5, 1]} renderOrder={11}>
          <octahedronGeometry args={[0.26, 0]} />
        </mesh>
      </group>
      <Html position={[0, PLATE_Y, 0]} center zIndexRange={[20, 0]} wrapperClass="np-wrap">
        <Nameplate p={p} plate={plate} />
      </Html>
    </group>
  )
}
