import * as THREE from 'three'
import { C } from '@/lib/palette'

// Shared, cached materials. Same color + settings => same material instance,
// which lets StaticMerge collapse the city into a handful of draw calls.

type MatOpts = {
  rough?: number
  metal?: number
  /** Painted ground-contact darkening (design.md §5). On by default for built forms. */
  grade?: boolean
  emissive?: string
  emissiveIntensity?: number
}

const cache = new Map<string, THREE.Material>()

export function mat(color: string, o: MatOpts = {}): THREE.MeshStandardMaterial {
  const { rough = 0.85, metal = 0, grade = true } = o
  const key = `${color}|${rough}|${metal}|${grade}|${o.emissive ?? ''}|${o.emissiveIntensity ?? ''}`
  let m = cache.get(key) as THREE.MeshStandardMaterial | undefined
  if (m) return m
  m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal })
  if (o.emissive) {
    m.emissive.set(o.emissive)
    m.emissiveIntensity = o.emissiveIntensity ?? 1
  }
  if (grade) applyGroundGrade(m)
  cache.set(key, m)
  return m
}

const PAINT_FNS = /* glsl */ `
varying vec3 vPaintPos;
varying vec3 vPaintN;
float pHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float pNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(pHash(i), pHash(i + vec3(1, 0, 0)), f.x), mix(pHash(i + vec3(0, 1, 0)), pHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(pHash(i + vec3(0, 0, 1)), pHash(i + vec3(1, 0, 1)), f.x), mix(pHash(i + vec3(0, 1, 1)), pHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}`

const PAINT_APPLY = /* glsl */ `
{
  vec3 n = normalize(vPaintN);
  vec3 an = abs(n);
  // painted ground-contact darkening
  diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(0.0, 2.6, vPaintPos.y));
  // soft hand-made colour variation
  float mott = pNoise(vPaintPos * 0.45) * 0.6 + pNoise(vPaintPos * 1.8) * 0.4;
  diffuseColor.rgb *= 0.95 + 0.09 * mott;
  // monsoon rain streaks on vertical walls
  float vert = 1.0 - smoothstep(0.2, 0.5, an.y);
  float streak = pNoise(vec3((vPaintPos.x + vPaintPos.z) * 2.4, vPaintPos.y * 0.11, 3.7));
  diffuseColor.rgb *= 1.0 - 0.09 * smoothstep(0.55, 0.85, streak) * vert;
  // worn, light-catching bevel edges
  float edge = smoothstep(0.06, 0.3, 1.0 - max(an.x, max(an.y, an.z)));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.22 + 0.025, edge);
}`

/**
 * Hand-painted surface treatment (design.md §5): ground-contact darkening,
 * gentle mottling, rain streaks and bright worn bevel edges — all procedural,
 * so it survives StaticMerge without UVs.
 */
export function applyGroundGrade(m: THREE.Material) {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPaintPos;\nvarying vec3 vPaintN;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvPaintPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvPaintN = normalize(mat3(modelMatrix) * objectNormal);',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PAINT_FNS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${PAINT_APPLY}`)
  }
  m.customProgramCacheKey = () => 'painted-surface'
}

let glass: THREE.MeshStandardMaterial | null = null
export function glassMat() {
  return (glass ??= new THREE.MeshStandardMaterial({
    color: C.GLASS,
    roughness: 0.1,
    metalness: 0.4,
    envMapIntensity: 1.5,
  }))
}

// NIGHT LIGHTS (design.md §7.3: at night only real light sources emit). One shared value, 0 by day,
// 1 once it's dark (lightsOn in daylight.ts), set by Lighting from the city's clock; every lit window
// and lamp reads it.
export const lights = { value: 0 }

/** Lit rooms behind the glass: warm bulbs, or the white tube lights half of Bengaluru still uses. */
export type Room = 'warm' | 'tube'
const ROOM: Record<Room, THREE.Color> = {
  warm: new THREE.Color('#FFC27A').multiplyScalar(1.15),
  tube: new THREE.Color('#E4EEF0').multiplyScalar(0.95),
}

/** A window with a lit room behind it: dark glass by day, glowing after dusk. Survives StaticMerge. */
export function applyRoomLight(m: THREE.Material, room: Room) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uLights = lights
    shader.uniforms.uRoom = { value: ROOM[room] }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uLights;\nuniform vec3 uRoom;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uRoom * uLights;')
  }
  m.customProgramCacheKey = () => `room-${room}`
}

const rooms = new Map<Room, THREE.MeshStandardMaterial>()
/** Glass with a room behind it that lights up at night. */
export function roomGlassMat(room: Room) {
  let m = rooms.get(room)
  if (!m) {
    m = glassMat().clone()
    applyRoomLight(m, room)
    rooms.set(room, m)
  }
  return m
}

/** Which special shader a material carries, so StaticMerge can give the merged copy the same one. */
export function surfaceKind(m: THREE.Material): 'painted' | Room | null {
  const k = m.customProgramCacheKey()
  return k === 'painted-surface' ? 'painted' : k === 'room-warm' ? 'warm' : k === 'room-tube' ? 'tube' : null
}

export function applySurfaceKind(m: THREE.Material, kind: 'painted' | Room | null) {
  if (kind === 'painted') applyGroundGrade(m)
  else if (kind) applyRoomLight(m, kind)
}

let lamp: THREE.MeshStandardMaterial | null = null
/** A street-lamp head: pale enamel by day, the brightest thing on the street at night (it blooms). */
export function lampMat() {
  return (lamp ??= new THREE.MeshStandardMaterial({ color: '#E9E4DA', roughness: 0.5, emissive: '#FFD9A0', emissiveIntensity: 0 }))
}

let leaf: THREE.MeshStandardMaterial | null = null
export function leafMat() {
  return (leaf ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }))
}

const texCache = new Map<string, THREE.Material>()
/**
 * A slow, faint variation across the ground in world space (two octaves of smooth noise, ±5%), on
 * top of a tiling texture, so its repeat never lines up into a visible pattern.
 */
function applyMacroVariation(m: THREE.Material) {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMacroPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvMacroPos = (modelMatrix * vec4(transformed, 1.0)).xz;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vMacroPos;
        float macroHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float macroNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(macroHash(i), macroHash(i + vec2(1.0, 0.0)), f.x), mix(macroHash(i + vec2(0.0, 1.0)), macroHash(i + vec2(1.0)), f.x), f.y);
        }`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        diffuseColor.rgb *= 1.0 + (macroNoise(vMacroPos / 17.0) - 0.5) * 0.08 + (macroNoise(vMacroPos / 6.3 + 11.0) - 0.5) * 0.04;`,
      )
  }
  m.customProgramCacheKey = () => 'macro-variation'
}

export function texMat(key: string, make: () => THREE.Texture, o: { rough?: number; grade?: boolean; metal?: number; vary?: boolean } = {}) {
  let m = texCache.get(key) as THREE.MeshStandardMaterial | undefined
  if (m) return m
  m = new THREE.MeshStandardMaterial({ map: make(), roughness: o.rough ?? 0.85, metalness: o.metal ?? 0 })
  if (o.grade) applyGroundGrade(m)
  else if (o.vary) applyMacroVariation(m)
  texCache.set(key, m)
  return m
}
