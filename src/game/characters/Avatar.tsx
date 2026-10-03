'use client'

import * as THREE from 'three'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useGame } from '../store'
import { CLIPS, ROSTER, getCharacter, type CharacterDef, type Rig } from './roster'

export type AvatarState = {
  mode: 'idle' | 'walk' | 'run'
  speed: number
  /** performance.now() until which the character waves (when idle). */
  waveUntil: number
}

const HEIGHT = 1.75

// Heroic proportion push (design.md §4.1): bigger head, hands and feet.
// The modular rig's clips only animate rotation/translation, so bone scale sticks.
const PROPORTIONS: Record<string, number> = {
  Chest: 1.05,
  Head: 1.16,
  'Wrist.L': 1.25,
  'Wrist.R': 1.25,
  'Foot.L': 1.12,
  'Foot.R': 1.12,
}

// Natural ground speed of each rig's clips (m/s), for foot-sync time scaling.
const STRIDE: Record<Rig, { walk: number; run: number }> = {
  modular: { walk: 1.7, run: 5.2 },
  robot: { walk: 2.6, run: 6.2 },
}

/** One-time per GLB: crease-angle normals, so faceted low-poly reads as painted, chunky forms. */
function prepareSource(scene: THREE.Object3D) {
  if (scene.userData.prepared) return
  scene.userData.prepared = true
  scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh
    if (!m.isMesh) return
    m.geometry = toCreasedNormals(m.geometry, (55 * Math.PI) / 180)
  })
}

function buildCharacter(source: THREE.Object3D, def: CharacterDef) {
  prepareSource(source)
  const root = cloneSkinned(source)
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh
    if (def.hide?.includes(o.name)) o.visible = false
    if (!m.isMesh) return
    m.castShadow = true
    m.receiveShadow = true
    m.frustumCulled = false
    const restyle = (src: THREE.Material) => {
      const mat = (src as THREE.MeshStandardMaterial).clone()
      const c = def.colors[mat.name]
      if (c && mat.color) mat.color.set(c)
      if (def.invisible?.includes(mat.name)) mat.visible = false
      const metal = /metal|gold/i.test(mat.name)
      mat.roughness = metal ? 0.35 : 0.55
      mat.metalness = metal ? 0.6 : 0.05
      return mat
    }
    m.material = Array.isArray(m.material) ? m.material.map(restyle) : restyle(m.material)
  })

  if (def.rig === 'modular') {
    root.traverse((o) => {
      const s = PROPORTIONS[o.name]
      if (s && (o as THREE.Bone).isBone) o.scale.setScalar(s)
    })
  }

  root.updateMatrixWorld(true)
  root.traverse((o) => (o as THREE.SkinnedMesh).isSkinnedMesh && (o as THREE.SkinnedMesh).skeleton.update())
  const box = new THREE.Box3().setFromObject(root, true)
  const h = box.max.y - box.min.y
  const s = h > 0.01 && h < 1000 ? HEIGHT / h : 1
  return { root, scale: s, offset: -box.min.y * s }
}

export function Avatar({ id, state }: { id: string; state: MutableRefObject<AvatarState> }) {
  const def = getCharacter(id)
  const gltf = useGLTF(def.file)
  const built = useMemo(() => buildCharacter(gltf.scene, def), [gltf, def])
  const group = useRef<THREE.Group>(null!)
  const { actions } = useAnimations(gltf.animations, group)
  const clips = CLIPS[def.rig]
  const current = useRef<string>('')

  useEffect(() => {
    const idle = actions[clips.idle]
    idle?.reset().play()
    current.current = clips.idle
    const wave = actions[clips.wave]
    if (wave) {
      wave.setLoop(THREE.LoopOnce, 1)
      wave.clampWhenFinished = false
      // say hello whenever a character steps up on the select screen
      if (useGame.getState().phase === 'create') state.current.waveUntil = performance.now() + wave.getClip().duration * 950
    }
  }, [actions, clips, state])

  useFrame(() => {
    const st = state.current
    const waving = st.mode === 'idle' && performance.now() < st.waveUntil
    const next = waving ? clips.wave : clips[st.mode]
    if (next !== current.current) {
      const from = actions[current.current]
      const to = actions[next]
      if (to) {
        from?.fadeOut(0.22)
        to.reset().fadeIn(0.22).play()
        current.current = next
      }
    }
    const walk = actions[clips.walk]
    const run = actions[clips.run]
    const stride = STRIDE[def.rig]
    if (walk) walk.timeScale = THREE.MathUtils.clamp(st.speed / stride.walk, 0.8, 2.2)
    if (run) run.timeScale = THREE.MathUtils.clamp(st.speed / stride.run, 0.8, 1.6)
  })

  return (
    <group ref={group} scale={built.scale} position={[0, built.offset, 0]}>
      <primitive object={built.root} />
    </group>
  )
}

for (const c of ROSTER) useGLTF.preload(c.file)
