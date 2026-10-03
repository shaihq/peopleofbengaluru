'use client'

import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { C } from '@/lib/palette'
import { canopyGeo } from '../geometry'
import { SUN_DIR } from './Lighting'

/** Painted gradient sky with a soft sun glow. */
export function SkyDome() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(C.SKY_TOP) },
          horizon: { value: new THREE.Color(C.SKY_HORIZON) },
          sunDir: { value: SUN_DIR },
          sunColor: { value: new THREE.Color('#FFF1D6') },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 top;
          uniform vec3 horizon;
          uniform vec3 sunDir;
          uniform vec3 sunColor;
          varying vec3 vDir;
          void main() {
            vec3 d = normalize(vDir);
            float h = max(d.y, 0.0);
            vec3 col = mix(horizon, top, pow(smoothstep(0.0, 0.42, h), 0.55));
            float s = max(dot(d, normalize(sunDir)), 0.0);
            col += sunColor * (pow(s, 900.0) * 3.0 + pow(s, 32.0) * 0.22 + pow(s, 4.0) * 0.08);
            if (d.y < 0.0) col = horizon * 0.96;
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  return (
    <mesh material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[520, 32, 16]} />
    </mesh>
  )
}

const CLOUDS: [number, number, number, number, number][] = [
  [-220, 105, -300, 1.0, 1],
  [-40, 125, -340, 1.3, 2],
  [160, 110, -290, 1.1, 3],
  [300, 95, -120, 0.9, 4],
  [-320, 100, -60, 1.0, 5],
  [-260, 115, 200, 1.2, 6],
  [120, 120, 320, 1.0, 7],
  [330, 110, 160, 0.9, 8],
]

/** Big soft stylized cumulus, drifting slowly. */
export function Clouds() {
  const group = useRef<THREE.Group>(null!)
  const material = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), [])
  const geos = useMemo(
    () =>
      CLOUDS.map(([, , , , seed]) => {
        let s = seed * 97
        const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
        const blobs: number[][] = []
        for (let i = 0; i < 7; i++) {
          const x = (i - 3) * 9 + (r() - 0.5) * 6
          blobs.push([x, (r() - 0.2) * 4 + (3 - Math.abs(i - 3)) * 2.5, (r() - 0.5) * 10, 9 + r() * 5 + (3 - Math.abs(i - 3)) * 1.5])
        }
        return canopyGeo(blobs, { seed: 900 + seed, deep: '#D9E2EE', mid: '#F2F5F9', light: '#FFFFFF', detail: 3, flat: 0.15 })
      }),
    [],
  )
  useFrame((_, dt) => {
    group.current.rotation.y += dt * 0.0025
  })
  return (
    <group ref={group}>
      {CLOUDS.map(([x, y, z, s], i) => (
        <mesh key={i} geometry={geos[i]} material={material} position={[x, y, z]} scale={[s, s * 0.8, s]} rotation={[0, Math.atan2(x, z), 0]} />
      ))}
    </group>
  )
}
