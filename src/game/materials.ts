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

let leaf: THREE.MeshStandardMaterial | null = null
export function leafMat() {
  return (leaf ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }))
}

const texCache = new Map<string, THREE.Material>()
export function texMat(key: string, make: () => THREE.Texture, o: { rough?: number; grade?: boolean; metal?: number } = {}) {
  let m = texCache.get(key) as THREE.MeshStandardMaterial | undefined
  if (m) return m
  m = new THREE.MeshStandardMaterial({ map: make(), roughness: o.rough ?? 0.85, metalness: o.metal ?? 0 })
  if (o.grade) applyGroundGrade(m)
  texCache.set(key, m)
  return m
}
