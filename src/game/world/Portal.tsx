'use client'

import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { C } from '@/lib/palette'
import { Box, Cyl, Sign } from './kit'
import type { Pose } from '../districts/active'

// The portal (design.md §14): clean, chunky, painted tech hardware in our
// palette, with an animated warm energy surface. A real light source — the
// only thing allowed to glow here.

const RING_R = 2.15
const RING_Y = 2.55
const SAFFRON = new THREE.Color('#FFB020')

/** Swirling energy membrane: saffron core → cream → powder-blue rim. Warm only (no purple/cyan). */
function energyMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uCore: { value: new THREE.Color('#FFF1D6') },
      uMid: { value: new THREE.Color('#FFB020') },
      uRim: { value: new THREE.Color('#9EC3D9') },
      uPulse: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uPulse;
      uniform vec3 uCore; uniform vec3 uMid; uniform vec3 uRim;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 1.0) discard;
        float a = atan(p.y, p.x);
        // inward spiral: angle twists more toward the centre, everything drifts inward over time
        float sw = a + (1.0 - r) * 3.2 + uTime * 0.55;
        float bands = sin(sw * 4.0 + r * 9.0 - uTime * 2.4) * 0.5 + 0.5;
        float n = noise(vec2(sw * 1.6, r * 5.0 - uTime * 1.3)) * 0.6 + noise(vec2(sw * 3.4, r * 11.0 - uTime * 2.2)) * 0.4;
        float swirl = smoothstep(0.35, 0.95, bands * 0.55 + n * 0.6);
        vec3 col = mix(uRim, uMid, smoothstep(0.98, 0.45, r));
        col = mix(col, uCore, smoothstep(0.35, 0.0, r) * 0.75);
        col += uCore * swirl * 0.35 * (1.0 - r);
        float rim = smoothstep(0.82, 0.99, r) * (1.0 - smoothstep(0.99, 1.0, r));
        col += uRim * rim * 1.2;
        float alpha = (0.45 + 0.4 * swirl) * smoothstep(1.0, 0.9, r);
        alpha = max(alpha, rim);
        // bright enough to bloom (it's a light source), with a soft breathing pulse
        float glow = 1.05 + 0.2 * sin(uTime * 1.7) + uPulse * 1.5;
        gl_FragColor = vec4(col * glow, alpha);
      }`,
  })
}

/** Soft additive glow on the plinth floor. */
function floorGlowMaterial() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,190,90,0.85)')
  grd.addColorStop(0.45, 'rgba(255,170,60,0.3)')
  grd.addColorStop(1, 'rgba(255,170,60,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
}

const N_MOTES = 46

export function Portal({ pose }: { pose: Pose }) {
  const energy = useMemo(energyMaterial, [])
  const floorGlow = useMemo(floorGlowMaterial, [])
  const motes = useRef<THREE.InstancedMesh>(null!)
  const ringLight = useRef<THREE.Mesh>(null!)
  const light = useRef<THREE.PointLight>(null!)
  const moteMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#FFE2A8', toneMapped: false }), [])
  const seeds = useMemo(() => Array.from({ length: N_MOTES }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random(), s: 0.35 + Math.random() * 0.6, z: (Math.random() - 0.5) * 0.5 })), [])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const stripMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#FFB020', emissive: SAFFRON, emissiveIntensity: 2.2, toneMapped: false }), [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    energy.uniforms.uTime.value = t
    stripMat.emissiveIntensity = 2.0 + Math.sin(t * 1.7) * 0.4
    light.current.intensity = 9 + Math.sin(t * 1.7) * 1.5
    // motes spiral inward across the membrane and get pulled through
    for (let i = 0; i < N_MOTES; i++) {
      const sd = seeds[i]
      const life = (sd.r + t * 0.18 * sd.s) % 1
      const rad = (1 - life) * RING_R * 1.05
      const ang = sd.a + life * 5.5
      const sc = 0.03 + 0.05 * Math.sin(life * Math.PI)
      m.makeScale(sc, sc, sc).setPosition(Math.cos(ang) * rad, RING_Y + Math.sin(ang) * rad, sd.z * (1 - life))
      motes.current.setMatrixAt(i, m)
    }
    motes.current.instanceMatrix.needsUpdate = true
  })

  const legs = [-1, 1]
  return (
    <group position={[pose.x, 0.15, pose.z]} rotation={[0, pose.face, 0]}>
      {/* plinth: stepped kota-stone discs with a saffron inlay */}
      <Cyl rt={3.4} h={0.1} p={[0, 0.05, 0]} c={C.KOTA} rough={0.7} seg={48} />
      <Cyl rt={2.75} h={0.06} p={[0, 0.13, 0]} c={C.WALL_WHITE} rough={0.6} seg={48} />
      <mesh position={[0, 0.165, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.55, 2.68, 64]} />
        <primitive object={stripMat} attach="material" />
      </mesh>
      <mesh position={[0, 0.17, 0]} rotation={[-Math.PI / 2, 0, 0]} material={floorGlow}>
        <planeGeometry args={[6, 6]} />
      </mesh>

      {/* side pillars + feet */}
      {legs.map((s) => (
        <group key={s} position={[s * 2.45, 0, 0]}>
          <Box s={[0.9, 0.35, 1.3]} p={[0, 0.33, 0]} c={C.INTERIOR} radius={0.08} />
          <Box s={[0.62, 4.6, 0.8]} p={[0, 2.5, 0]} c={C.WALL_WHITE} radius={0.12} />
          <Box s={[0.66, 0.5, 0.84]} p={[0, 4.35, 0]} c="#2B2F45" radius={0.08} />
          <Box s={[0.08, 3.2, 0.06]} p={[s * -0.33, 2.4, 0.38]} material={stripMat} radius={0.02} />
          <Box s={[0.08, 3.2, 0.06]} p={[s * -0.33, 2.4, -0.38]} material={stripMat} radius={0.02} />
        </group>
      ))}

      {/* the ring: chunky cream torus, ink inner lip, saffron light strip, four clamps */}
      <mesh position={[0, RING_Y, 0]} castShadow>
        <torusGeometry args={[RING_R + 0.1, 0.3, 20, 72]} />
        <meshStandardMaterial color={C.WALL_WHITE} roughness={0.45} metalness={0.15} />
      </mesh>
      <mesh position={[0, RING_Y, 0]}>
        <torusGeometry args={[RING_R - 0.12, 0.12, 14, 72]} />
        <meshStandardMaterial color="#2B2F45" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh ref={ringLight} position={[0, RING_Y, 0]}>
        <torusGeometry args={[RING_R + 0.1, 0.06, 10, 96]} />
        <primitive object={stripMat} attach="material" />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = Math.PI / 4 + (i * Math.PI) / 2
        return (
          <group key={i} position={[Math.cos(a) * (RING_R + 0.1), RING_Y + Math.sin(a) * (RING_R + 0.1), 0]} rotation={[0, 0, a]}>
            <Box s={[0.7, 0.42, 0.85]} c="#2B2F45" radius={0.08} />
            <Box s={[0.12, 0.44, 0.88]} p={[0.18, 0, 0]} material={stripMat} radius={0.03} />
          </group>
        )
      })}

      {/* energy membrane + motes */}
      <mesh position={[0, RING_Y, 0]} material={energy} renderOrder={5}>
        <circleGeometry args={[RING_R - 0.15, 64]} />
      </mesh>
      <instancedMesh ref={motes} args={[undefined, undefined, N_MOTES]} material={moteMat} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
      </instancedMesh>

      <pointLight ref={light} position={[0, RING_Y, 0.6]} color="#FFB45A" intensity={9} distance={11} decay={2} />

      {/* hand-painted sign (Kannada + English), like the street signs */}
      <Sign
        p={[0, RING_Y + RING_R + 0.95, 0]}
        w={3.6}
        h={0.95}
        spec={{ title: 'TRAVEL', kn: 'ಪ್ರಯಾಣ', sub: 'HSR · BELLANDUR · WHITEFIELD · DOMLUR · KORAMANGALA', bg: '#2B2F45', fg: '#FFB020' }}
        frame={C.WALL_WHITE}
      />
    </group>
  )
}
