'use client'

import * as THREE from 'three'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { BOUNDS, LANDMARKS, groundHeight } from '../layout'
import { useGame } from '../store'
import { Avatar, type AvatarState } from '../characters/Avatar'
import { installInput, keys, look } from './input'
import { rayDistance, resolveCircle } from './collision'
import { bodies, player, resolveBodies } from '../people/bodies'
import { findPath } from '../nav'
import { route } from '../tracking'
import { useDirectory } from '../people/directory'
import { useOnboarding } from '../onboarding'
import { DraftPlate } from '../hud/DraftPlate'
import { footstep } from '../audio/footsteps'

const WALK = 3.0
const RUN = 6.8
const RADIUS = 0.38
const SPAWN = new THREE.Vector3(1.6, 0, 21)
const TALK_RANGE = 2.7
const ARRIVE = 2.3
const FLY = 2.4 // seconds: camera arcs over the city to them
const HOLD = 1.6 // seconds: camera holds on them
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

const damp = (a: number, b: number, rate: number, dt: number) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-rate * dt))
function dampAngle(a: number, b: number, rate: number, dt: number) {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * (1 - Math.exp(-rate * dt))
}

export function Player() {
  const root = useRef<THREE.Group>(null!)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const phase = useGame((s) => s.phase)
  const me = useDirectory((s) => s.me)
  const draftCharacter = useOnboarding((s) => s.draft.character)
  // guests are invisible; creating shows the draft look; members are themselves
  const characterId = phase === 'create' ? draftCharacter : me ? me.character : 'invisible'
  const charRef = useRef(characterId)
  charRef.current = characterId
  const avatar = useRef<AvatarState>({ mode: 'idle', speed: 0, waveUntil: 0 })

  const st = useRef({
    pos: SPAWN.clone(),
    vel: new THREE.Vector3(),
    facing: Math.PI,
    camPos: new THREE.Vector3(),
    flyFrom: new THREE.Vector3(),
    flyLook: new THREE.Vector3(),
    stage: null as string | null,
    phase: '' as string,
    manual: false,
    repathT: 0,
    lookAt: new THREE.Vector3(6, 3, -4),
    landmarkT: 0,
    initialised: false,
  })

  useEffect(() => installInput(), [])

  useEffect(() => {
    player.pos = st.current.pos
    return () => {
      player.pos = null
    }
  }, [])

  // Dev-only hook for scripted screenshots / debugging.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    ;(window as unknown as { __dob?: unknown }).__dob = {
      pos: () => st.current.pos.toArray().map((n) => +n.toFixed(2)),
      teleport: (x: number, z: number, yaw: number, pitch = 0.22) => {
        st.current.pos.set(x, 0, z)
        look.yaw = yaw
        look.pitch = pitch
      },
    }
  }, [])

  const v = useMemo(
    () => ({
      fwd: new THREE.Vector3(),
      right: new THREE.Vector3(),
      wish: new THREE.Vector3(),
      target: new THREE.Vector3(),
      head: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      goal: new THREE.Vector3(),
      face: new THREE.Vector3(),
      mid: new THREE.Vector3(),
      p: new THREE.Vector3(),
    }),
    [],
  )

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const s = st.current
    const game = useGame.getState()
    const talking = game.openId ? bodies.get(game.openId) : undefined
    const tracking = game.trackId ? bodies.get(game.trackId) : undefined
    const stage = tracking ? game.trackStage : null
    const cinematic = stage === 'fly' || stage === 'hold'
    const play = game.phase === 'play' && !talking && !game.searchOpen && !game.paused && !cinematic
    const select = game.phase === 'create'
    if (game.phase !== s.phase) {
      // character creation always happens on the home street, facing the camera
      if (select) {
        s.pos.copy(SPAWN)
        s.vel.set(0, 0, 0)
      }
      s.phase = game.phase
    }
    const stageT = (performance.now() - game.trackT0) / 1000
    if (stage !== s.stage) {
      s.stage = stage
      s.manual = false
      s.repathT = 0
      if (stage === 'fly') {
        s.flyFrom.copy(s.camPos)
        s.flyLook.copy(s.lookAt)
      }
    }
    if (!tracking && game.trackId) game.stopTracking()

    // --- movement --------------------------------------------------------
    let ix = 0
    let iz = 0
    if (play) {
      if (keys.KeyW || keys.ArrowUp) iz += 1
      if (keys.KeyS || keys.ArrowDown) iz -= 1
      if (keys.KeyD || keys.ArrowRight) ix += 1
      if (keys.KeyA || keys.ArrowLeft) ix -= 1
    }
    let running = play && (keys.ShiftLeft || keys.ShiftRight)
    const yaw = look.yaw
    v.fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw))
    v.right.set(Math.cos(yaw), 0, -Math.sin(yaw))
    v.wish.set(0, 0, 0).addScaledVector(v.fwd, iz).addScaledVector(v.right, ix)
    if (ix || iz) s.manual = true // WASD takes over from auto-travel

    // --- auto-travel to the tracked person --------------------------------
    if (tracking && stage === 'walk') {
      const dTarget = Math.hypot(tracking.x - s.pos.x, tracking.z - s.pos.z)
      if (dTarget < ARRIVE) {
        game.setTrackStage('found')
        route.path = []
      } else {
        s.repathT -= dt
        if (s.repathT <= 0 || !route.path.length) {
          s.repathT = 1.2
          route.path = findPath(s.pos.x, s.pos.z, tracking.x, tracking.z) ?? []
        }
        // drop waypoints we've reached
        while (route.path.length > 1 && Math.hypot(route.path[1][0] - s.pos.x, route.path[1][1] - s.pos.z) < 0.7) route.path.shift()
        route.path[0] = [s.pos.x, s.pos.z]
        if (play && !s.manual && route.path.length > 1) {
          const [nx, nz] = route.path[1]
          v.wish.set(nx - s.pos.x, 0, nz - s.pos.z)
          running = true
          // ease the camera round behind the direction of travel
          look.yaw = dampAngle(look.yaw, Math.atan2(-v.wish.x, -v.wish.z), 2.2, dt)
        }
      }
    } else if (stage !== 'walk' && route.path.length) route.path = []
    if (stage === 'found' && stageT > 2.2) game.stopTracking()

    const moving = v.wish.lengthSq() > 0
    if (moving) v.wish.normalize()
    v.target.copy(v.wish).multiplyScalar(running ? RUN : WALK)
    s.vel.lerp(v.target, 1 - Math.exp(-(moving ? 9 : 12) * dt))
    s.pos.addScaledVector(s.vel, dt)
    resolveBodies(s.pos, RADIUS)
    resolveCircle(s.pos, RADIUS)
    s.pos.x = THREE.MathUtils.clamp(s.pos.x, -BOUNDS, BOUNDS)
    s.pos.z = THREE.MathUtils.clamp(s.pos.z, -BOUNDS, BOUNDS)
    s.pos.y = damp(s.pos.y, groundHeight(s.pos.x, s.pos.z), 20, dt)

    const speed = Math.hypot(s.vel.x, s.vel.z)
    const since = (performance.now() - game.enteredAt) / 1000
    if (speed > 0.15) s.facing = dampAngle(s.facing, Math.atan2(s.vel.x, s.vel.z), 12, dt)
    else if (talking) s.facing = dampAngle(s.facing, Math.atan2(talking.x - s.pos.x, talking.z - s.pos.z), 8, dt)
    else if (select) s.facing = dampAngle(s.facing, 0, 5, dt) // face the camera on the select screen
    else if (play && since < 1.6) s.facing = dampAngle(s.facing, Math.PI + yaw, 5, dt) // turn to face the street
    root.current.position.copy(s.pos)
    root.current.rotation.y = s.facing

    // --- animation -------------------------------------------------------
    avatar.current.speed = speed
    avatar.current.mode = speed < 0.35 ? 'idle' : speed < 4.6 ? 'walk' : 'run'

    // --- camera ----------------------------------------------------------
    const t = state.clock.elapsedTime
    if (cinematic && tracking) {
      // the locate shot: lift off, arc over the rooftops, land on them
      v.face.set(tracking.x - s.pos.x, 0, tracking.z - s.pos.z)
      const dist = v.face.length()
      v.face.normalize()
      v.goal.set(tracking.x - v.face.x * 6.5, tracking.y + 3.6, tracking.z - v.face.z * 6.5)
      v.head.set(tracking.x, tracking.y + 1.3, tracking.z)
      if (stage === 'fly') {
        const k = ease(Math.min(1, stageT / FLY))
        v.mid.addVectors(s.flyFrom, v.goal).multiplyScalar(0.5)
        v.mid.y += 14 + dist * 0.3
        // quadratic bezier from, mid, goal
        v.p.copy(s.flyFrom).multiplyScalar((1 - k) * (1 - k)).addScaledVector(v.mid, 2 * (1 - k) * k).addScaledVector(v.goal, k * k)
        s.camPos.copy(v.p)
        s.lookAt.lerpVectors(s.flyLook, v.head, ease(Math.min(1, stageT / (FLY * 0.6))))
        if (stageT > FLY) game.setTrackStage('hold')
      } else {
        const a = stageT * 0.25
        v.p.set(v.goal.x - tracking.x, 0, v.goal.z - tracking.z).applyAxisAngle(THREE.Object3D.DEFAULT_UP, a)
        s.camPos.set(tracking.x + v.p.x, v.goal.y, tracking.z + v.p.z)
        s.lookAt.copy(v.head)
        if (stageT > HOLD) game.setTrackStage('walk')
      }
      camera.fov = damp(camera.fov, 50, 3, dt)
      camera.updateProjectionMatrix()
    } else if (talking) {
      // conversation framing: them on the left third, profile panel on the right
      v.face.set(s.pos.x - talking.x, 0, s.pos.z - talking.z).normalize()
      const rx = v.face.z
      const rz = -v.face.x
      // camera swings out to the side so you step out of the shot (under the panel)
      v.goal.set(talking.x + v.face.x * 3.5 - rx * 1.8, talking.y + 1.5, talking.z + v.face.z * 3.5 - rz * 1.8)
      v.head.set(talking.x + rx * 0.8, talking.y + 1.1, talking.z + rz * 0.8)
      s.camPos.lerp(v.goal, 1 - Math.exp(-4 * dt))
      s.lookAt.lerp(v.head, 1 - Math.exp(-5 * dt))
      camera.fov = damp(camera.fov, 46, 4, dt)
      camera.updateProjectionMatrix()
    } else if (select) {
      // character-select framing: hero on the right, junction + metro behind
      // pulled back enough that your live nameplate preview fits in frame
      v.goal.set(s.pos.x - 0.45, s.pos.y + 1.45, s.pos.z + 5.6)
      v.head.set(s.pos.x - 1.45, s.pos.y + 1.25, s.pos.z)
      s.camPos.lerp(v.goal, 1 - Math.exp(-3 * dt))
      s.lookAt.lerp(v.head, 1 - Math.exp(-4 * dt))
      camera.fov = damp(camera.fov, 42, 3, dt)
      camera.updateProjectionMatrix()
    } else if (game.phase === 'intro') {
      const a = t * 0.05 + 0.5
      v.goal.set(6 + Math.sin(a) * 42, 23 + Math.sin(t * 0.13) * 2, -2 + Math.cos(a) * 42)
      if (!s.initialised) {
        s.camPos.copy(v.goal)
        s.initialised = true
      }
      s.camPos.lerp(v.goal, 1 - Math.exp(-2 * dt))
      s.lookAt.lerp(v.head.set(6, 3, -4), 1 - Math.exp(-3 * dt))
    } else {
      // blend from the cinematic orbit (or a locate shot) into the follow cam
      const sinceStage = stage === 'walk' || stage === 'found' ? stageT : Infinity
      const blend = Math.min(since, sinceStage)
      const rate = THREE.MathUtils.lerp(2.2, 14, THREE.MathUtils.smoothstep(blend, 0, 2.2))
      const pitch = look.pitch
      v.head.set(s.pos.x, s.pos.y + 1.5, s.pos.z).addScaledVector(v.right, 0.55)
      v.dir.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
      const want = running && speed > 4 ? 4.6 : 3.9
      const hit = rayDistance(v.head, v.dir, want + 0.4)
      const dist = Math.max(0.9, Math.min(want, hit - 0.35))
      v.goal.copy(v.head).addScaledVector(v.dir, dist)
      v.goal.y = Math.max(v.goal.y, s.pos.y + 0.4)
      s.camPos.lerp(v.goal, 1 - Math.exp(-rate * dt))
      s.lookAt.lerp(v.head, 1 - Math.exp(-Math.max(rate, 6) * 1.4 * dt))
      camera.fov = damp(camera.fov, running && speed > 4 ? 60 : 56, 4, dt)
      camera.updateProjectionMatrix()
    }
    camera.position.copy(s.camPos)
    camera.lookAt(s.lookAt)

    // --- who can I talk to? (closest person roughly in front of you) -----
    if (play) {
      let best: string | null = null
      let bestScore = Infinity
      const fx = Math.sin(s.facing)
      const fz = Math.cos(s.facing)
      for (const [id, b] of bodies) {
        const dx = b.x - s.pos.x
        const dz = b.z - s.pos.z
        const d = Math.hypot(dx, dz)
        if (d > TALK_RANGE) continue
        const score = d - ((dx * fx + dz * fz) / Math.max(d, 0.001)) * 0.9
        if (score < bestScore) {
          bestScore = score
          best = id
        }
      }
      if (best !== game.focusId) game.setFocus(best)
    }

    // --- landmark for the HUD ---------------------------------------------
    s.landmarkT -= dt
    if (s.landmarkT <= 0) {
      s.landmarkT = 0.3
      const lm = LANDMARKS.find((l) => Math.hypot(l.x - s.pos.x, l.z - s.pos.z) < l.r)?.label ?? '5TH BLOCK'
      if (lm !== game.landmark) game.setLandmark(lm)
    }
  })

  return (
    <group ref={root}>
      <Suspense fallback={null}>
        <Avatar
          key={characterId}
          id={characterId}
          state={avatar}
          onStep={() => {
            const p = st.current.pos
            footstep(charRef.current, p.x, p.y, p.z, avatar.current.mode === 'run', true)
          }}
        />
      </Suspense>
      {phase === 'create' && (
        <Html position={[0, 2.2, 0]} center zIndexRange={[20, 0]} wrapperClass="np-wrap">
          <DraftPlate />
        </Html>
      )}
    </group>
  )
}
