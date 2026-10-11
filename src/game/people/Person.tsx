'use client'

import * as THREE from 'three'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Avatar, type AvatarState } from '../characters/Avatar'
import { active } from '../districts/active'
import { useGame } from '../store'
import { bodies, player } from './bodies'
import { plates, type Lod } from './plates'
import { footstep } from '../audio/footsteps'
import { revealed } from '../audio/cues'
import type { Profile } from './profiles'
import { activeStatus } from '../status'
import { StatusBubble } from '../hud/StatusBubble'
import { Wanderer } from './wander'
import { rayDistance, resolveCircle } from '../player/collision'
import { poseOf } from '../net/remotes'
import { useNet } from '../net/useNet'

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

// a member who comes online mid-walk eases into where they really are, unless that's far or out of sight
const BLEND_S = 0.5
const SNAP_M = 6
const ease = (t: number) => t * t * (3 - 2 * t)

function Nameplate({ p, plate }: { p: Profile; plate: React.RefObject<HTMLDivElement | null> }) {
  const status = activeStatus(p.status)
  const here = useNet((s) => s.live.has(p.id))
  return (
    <div ref={plate} className="np" data-lod="off">
      {here && (
        <div className="np-here">
          <span className="np-here-dot" /> HERE NOW
        </div>
      )}
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
      {status && <StatusBubble s={status} />}
      <div className="np-caret" />
    </div>
  )
}

/**
 * A person in the district: character + nameplate + routine. Offline (and samples) they wander their
 * neighbourhood; a member who is online is wherever they really are (CLAUDE.md Phase 8A).
 */
export function Person({ p }: { p: Profile }) {
  const root = useRef<THREE.Group>(null!)
  const plate = useRef<HTMLDivElement>(null)
  const avatar = useRef<AvatarState>({ mode: 'idle', speed: 0, waveUntil: 0 })
  const camera = useThree((s) => s.camera)
  const start = p.spot ? [p.spot.x, p.spot.z] : p.path![0]
  const st = useRef({
    pos: new THREE.Vector3(start[0], 0, start[1]),
    facing: p.spot?.face ?? 0,
    occT: Math.random() * 0.2,
    occluded: false,
    engaged: false,
    want: 'off' as Lod,
    live: false,
    blend: 1,
    from: new THREE.Vector3(),
    liveSpeed: 0,
  })
  // offline: the character keeps walking around their neighbourhood
  const walkerRef = useRef<Wanderer | null>(null)
  walkerRef.current ??= new Wanderer(start[0], start[1], p.spot?.face ?? 0, p.location)
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
  const tmp = useMemo(() => ({ head: new THREE.Vector3(), dir: new THREE.Vector3(), scr: new THREE.Vector3(), side: new THREE.Vector3(), pt: new THREE.Vector3() }), [])

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

    const g = useGame.getState()
    const tracked = g.trackId === p.id
    const engaged = g.focusId === p.id || g.openId === p.id || (tracked && g.trackStage === 'found')
    const pose = poseOf(p.id)
    let speed = 0
    let mode: AvatarState['mode'] = 'idle'

    if (pose) {
      // --- live: a real person, where they really are -------------------
      if (!s.live) {
        s.live = true
        s.from.copy(s.pos)
        const far = Math.hypot(pose.x - s.pos.x, pose.z - s.pos.z) > SNAP_M
        s.blend = far || s.occluded || s.want === 'off' ? 1 : 0
      }
      s.blend = Math.min(1, s.blend + dt / BLEND_S)
      const k = ease(s.blend)
      const px = s.pos.x
      const pz = s.pos.z
      s.pos.x = k < 1 ? s.from.x + (pose.x - s.from.x) * k : pose.x
      s.pos.z = k < 1 ? s.from.z + (pose.z - s.from.z) * k : pose.z
      const v = dt > 0 ? Math.hypot(s.pos.x - px, s.pos.z - pz) / dt : 0
      s.liveSpeed = THREE.MathUtils.damp(s.liveSpeed, v, 8, dt)
      s.facing = dampAngle(s.facing, pose.yaw, 12, dt)
      mode = pose.parked ? 'idle' : pose.mode
      speed = mode === 'idle' ? 0 : Math.max(0.6, s.liveSpeed)
      s.engaged = engaged
    } else {
      if (s.live) {
        // they went offline (or the connection dropped): back to wandering from right here
        s.live = false
        walkerRef.current = new Wanderer(s.pos.x, s.pos.z, s.facing, p.location)
      }
      // --- engaged with the player? stop, turn to them, say hi ---------
      if (engaged && !s.engaged) avatar.current.waveUntil = performance.now() + 1900
      s.engaged = engaged
      const walker = walkerRef.current!
      if (engaged && player.pos) {
        s.facing = dampAngle(s.facing, Math.atan2(player.pos.x - s.pos.x, player.pos.z - s.pos.z), 7, dt)
        walker.speed = 0
      } else {
        walker.update(dt)
        s.pos.x = walker.x
        s.pos.z = walker.z
        resolveCircle(s.pos, 0.3) // never clip into buildings or props
        walker.x = s.pos.x
        walker.z = s.pos.z
        s.facing = walker.facing
        speed = walker.speed
      }
      walker.facing = s.facing
      mode = speed > 0.1 ? 'walk' : 'idle'
    }
    s.pos.y = THREE.MathUtils.damp(s.pos.y, active.def.ground(s.pos.x, s.pos.z), 20, dt)
    root.current.position.copy(s.pos)
    root.current.rotation.y = s.facing
    avatar.current.speed = speed
    avatar.current.mode = mode

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
      // Hidden only when a real wall is in the way: three rays (head, and half a metre
      // either side). A street pole, sign or tree trunk can block one — never all three.
      tmp.side.set(tmp.head.z - camera.position.z, 0, camera.position.x - tmp.head.x).normalize().multiplyScalar(0.5)
      s.occluded = [0, 1, -1].every((k) => {
        tmp.pt.copy(tmp.head).addScaledVector(tmp.side, k)
        const dk = camera.position.distanceTo(tmp.pt)
        tmp.dir.subVectors(tmp.pt, camera.position).normalize()
        return rayDistance(camera.position, tmp.dir, dk) < dk - 0.6
      })
    }
    const want: Lod = !playing || g.openId || g.searchOpen || g.paused || s.occluded || d > FAR ? 'off' : d < NEAR ? 'near' : d < MID ? 'mid' : 'far'
    // they just came into view (≈22m) → the discovery cue, from where they stand
    if ((want === 'near' || want === 'mid') && (s.want === 'off' || s.want === 'far')) revealed(p.id, s.pos.x, s.pos.y, s.pos.z)
    s.want = want
    tmp.scr.set(s.pos.x, s.pos.y + PLATE_Y, s.pos.z).project(camera)
    // hand off to the declutter pass in <People/>
    const req = plates.get(p.id)
    const tall = !!activeStatus(p.status)
    if (req) Object.assign(req, { el, d, want, x: tmp.scr.x, y: tmp.scr.y, behind: tmp.scr.z > 1, tall })
    else plates.set(p.id, { el, d, want, x: tmp.scr.x, y: tmp.scr.y, behind: tmp.scr.z > 1, shown: 'off', tall })
  })

  return (
    <group ref={root}>
      <Suspense fallback={null}>
        <Avatar
          id={p.character}
          state={avatar}
          onStep={() => {
            const q = st.current.pos
            if (camera.position.distanceToSquared(q) < 196) footstep(p.character, q.x, q.y, q.z, false, false)
          }}
        />
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
