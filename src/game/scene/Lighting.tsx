'use client'

import * as THREE from 'three'
import { useLayoutEffect, useRef } from 'react'
import { Environment, Lightformer } from '@react-three/drei'
import { C } from '@/lib/palette'
import { quality } from '../device'

// Late-morning Bengaluru sun (design.md §7.1): warm key from the south-west,
// cool sky fill, warm ground bounce, cool rim from behind.
export const SUN_DIR = new THREE.Vector3(-0.55, 0.78, 0.42).normalize()

export function Lighting() {
  const sun = useRef<THREE.DirectionalLight>(null!)

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

  return (
    <>
      <hemisphereLight args={[C.SKY_TOP_LIGHT, C.GROUND_BOUNCE, 1.15]} />
      <directionalLight
        ref={sun}
        position={sunPos}
        color={C.SUN}
        intensity={3.1}
        castShadow
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
