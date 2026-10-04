'use client'

import * as THREE from 'three'
import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { player } from '../people/bodies'
import { useGame } from '../store'
import { Environment, Lightformer } from '@react-three/drei'
import { C } from '@/lib/palette'
import { flag, quality, showQualityDebug, useDebugToggles } from '../device'

const SHADOWS = flag('shadows') // diagnostics: 'off' | 'static'

// Late-morning Bengaluru sun (design.md §7.1): warm key from the south-west,
// cool sky fill, warm ground bounce, cool rim from behind.
export const SUN_DIR = new THREE.Vector3(-0.55, 0.78, 0.42).normalize()

// The sun's own axes. The shadow box is snapped along THESE (not world x/z), so it
// only ever moves by whole shadow-map texels and nothing re-samples as you walk.
const LIGHT_X = new THREE.Vector3()
const LIGHT_Y = new THREE.Vector3()
new THREE.Matrix4().lookAt(SUN_DIR, new THREE.Vector3(), new THREE.Vector3(0, 1, 0)).extractBasis(LIGHT_X, LIGHT_Y, new THREE.Vector3())
const _center = new THREE.Vector3()

export function Lighting() {
  const sun = useRef<THREE.DirectionalLight>(null!)
  const dbgShadows = useDebugToggles((s) => s.shadows)

  useLayoutEffect(() => {
    const s = sun.current
    s.target.position.set(0, 0, 0)
    s.target.updateMatrixWorld()
    const cam = s.shadow.camera
    cam.left = -62
    cam.right = 62
    cam.top = 62
    cam.bottom = -62
    cam.near = 1
    cam.far = 280
    cam.updateProjectionMatrix()
  }, [])

  const sunPos = SUN_DIR.clone().multiplyScalar(130)

  // Shadows follow you: a tight box around the player = much sharper shadows from the
  // same shadow map. The wide intro orbit still gets the whole district.
  const extent = useRef(62)
  useFrame(() => {
    const s = sun.current
    const playing = SHADOWS !== 'static' && useGame.getState().phase !== 'intro' && player.pos
    const want = playing ? 34 : 62
    if (want !== extent.current) {
      extent.current = want
      const cam = s.shadow.camera
      cam.left = cam.bottom = -want
      cam.right = cam.top = want
      cam.updateProjectionMatrix()
    }
    if (playing) {
      const p = player.pos!
      const texel = (want * 2) / quality.shadowMap
      const u = Math.round(p.dot(LIGHT_X) / texel) * texel
      const v = Math.round(p.dot(LIGHT_Y) / texel) * texel
      // no component along the sun: depth values in the shadow map never drift
      _center.copy(LIGHT_X).multiplyScalar(u).addScaledVector(LIGHT_Y, v)
    } else _center.set(0, 0, 0)
    s.position.copy(_center).addScaledVector(SUN_DIR, 130)
    s.target.position.copy(_center)
    s.target.updateMatrixWorld()
  })

  return (
    <>
      <hemisphereLight args={[C.SKY_TOP_LIGHT, C.GROUND_BOUNCE, 1.15]} />
      <directionalLight
        ref={sun}
        position={sunPos}
        color={C.SUN}
        intensity={3.1}
        castShadow={SHADOWS !== 'off' && (!showQualityDebug || dbgShadows)}
        shadow-mapSize={[quality.shadowMap, quality.shadowMap]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.04}
        shadow-radius={3}
      />
      <directionalLight position={[60, 25, -50]} color="#B8CFF2" intensity={0.55} />
      <Environment resolution={128} frames={1} environmentIntensity={0.6}>
        <Lightformer form="rect" intensity={1.3} color={C.SKY_TOP} scale={[80, 80, 1]} position={[0, 40, 0]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={3} color={C.SUN} scale={[25, 25, 1]} position={SUN_DIR.clone().multiplyScalar(50)} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.9} color={C.SKY_HORIZON} scale={[200, 20, 1]} position={[0, 4, -60]} />
        <Lightformer form="rect" intensity={0.7} color={C.GROUND_BOUNCE} scale={[80, 80, 1]} position={[0, -20, 0]} rotation-x={-Math.PI / 2} />
      </Environment>
    </>
  )
}
