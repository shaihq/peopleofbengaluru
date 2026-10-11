'use client'

import * as THREE from 'three'
import { useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { player } from '../people/bodies'
import { useGame } from '../store'
import { Environment, Lightformer } from '@react-three/drei'
import { flag, quality, showQualityDebug, useDebugToggles } from '../device'
import { daylight, tickDaylight, useClock } from './time'
import { lights } from '../materials'
import { lightsOn } from './daylight'

const SHADOWS = flag('shadows') // diagnostics: 'off' | 'static'

// Bengaluru light on the city's real clock (design.md §7.1, §7.3): a warm key sun (the moon at night),
// sky fill, ground bounce and a cool rim from behind. The looks themselves are in daylight.ts.
/** Where the light comes from right now (mutated in place as the hour moves; the sky reads it too). */
export const SUN_DIR = new THREE.Vector3(...daylight.look.sunDir).normalize()

// The sun's own axes. The shadow box is snapped along THESE (not world x/z), so it
// only ever moves by whole shadow-map texels and nothing re-samples as you walk.
// They're re-derived when the sun moves (a few times a minute, by a hair).
const LIGHT_X = new THREE.Vector3()
const LIGHT_Y = new THREE.Vector3()
const _m = new THREE.Matrix4()
const _zero = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _z = new THREE.Vector3()
const sunAxes = () => _m.lookAt(SUN_DIR, _zero, _up).extractBasis(LIGHT_X, LIGHT_Y, _z)
sunAxes()
const _center = new THREE.Vector3()

export function Lighting() {
  const sun = useRef<THREE.DirectionalLight>(null!)
  const hemi = useRef<THREE.HemisphereLight>(null!)
  const rim = useRef<THREE.DirectionalLight>(null!)
  const dbgShadows = useDebugToggles((s) => s.shadows)
  const scene = useThree((s) => s.scene)
  // the reflections are baked once; rebake every 10 minutes of the clock
  const envKey = useClock((s) => Math.floor(s.hour * 6))
  const look = daylight.look
  const seen = useRef(-1)

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
    const d = tickDaylight()
    if (d.v !== seen.current) {
      seen.current = d.v
      const l = d.look
      SUN_DIR.set(...l.sunDir).normalize()
      sunAxes()
      s.color.set(l.sun)
      s.intensity = l.sunI
      hemi.current.color.set(l.sky)
      hemi.current.groundColor.set(l.ground)
      hemi.current.intensity = l.hemiI
      rim.current.color.set(l.rim)
      rim.current.intensity = l.rimI
      lights.value = lightsOn(l.night)
      if (scene.fog) scene.fog.color.set(l.fog)
      if (scene.background instanceof THREE.Color) scene.background.set(l.fog)
    }
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
      <hemisphereLight ref={hemi} args={[look.sky, look.ground, look.hemiI]} />
      <directionalLight
        ref={sun}
        position={sunPos}
        color={look.sun}
        intensity={look.sunI}
        castShadow={SHADOWS !== 'off' && (!showQualityDebug || dbgShadows)}
        shadow-mapSize={[quality.shadowMap, quality.shadowMap]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.04}
        shadow-radius={3}
      />
      <directionalLight ref={rim} position={[60, 25, -50]} color={look.rim} intensity={look.rimI} />
      <Environment key={envKey} resolution={128} frames={1} environmentIntensity={look.envI}>
        <Lightformer form="rect" intensity={1.3} color={look.envTop} scale={[80, 80, 1]} position={[0, 40, 0]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={3 * (1 - look.night * 0.7)} color={look.sun} scale={[25, 25, 1]} position={SUN_DIR.clone().multiplyScalar(50)} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.9} color={look.horizon} scale={[200, 20, 1]} position={[0, 4, -60]} />
        <Lightformer form="rect" intensity={0.7} color={look.ground} scale={[80, 80, 1]} position={[0, -20, 0]} rotation-x={-Math.PI / 2} />
      </Environment>
    </>
  )
}
