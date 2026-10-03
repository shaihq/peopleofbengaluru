import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { rng } from './textures'

// Cached geometry builders. design.md §6.1: no raw boxes — every box is bevelled.

const cache = new Map<string, THREE.BufferGeometry>()
const f = (n: number) => n.toFixed(3)

function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = cache.get(key) as T | undefined
  if (!g) {
    g = make()
    cache.set(key, g)
  }
  return g
}

export function rbox(w: number, h: number, d: number, radius?: number) {
  const m = Math.min(w, h, d)
  const r = Math.max(0.004, Math.min(radius ?? Math.min(m * 0.12, 0.12), m / 2 - 0.002))
  const seg = m < 0.4 ? 1 : 2
  return cached(`rb|${f(w)}|${f(h)}|${f(d)}|${f(r)}|${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, r))
}

export function cyl(rt: number, rb: number, h: number, seg = 20) {
  return cached(`cy|${f(rt)}|${f(rb)}|${f(h)}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1))
}

export function plane(w: number, h: number) {
  return cached(`pl|${f(w)}|${f(h)}`, () => new THREE.PlaneGeometry(w, h))
}

export function torus(r: number, tube: number) {
  return cached(`to|${f(r)}|${f(tube)}`, () => new THREE.TorusGeometry(r, tube, 10, 20))
}

/** Triangular gable end, lying in the XY plane, extruded along Z. */
export function gable(w: number, rise: number, thick: number) {
  return cached(`gb|${f(w)}|${f(rise)}|${f(thick)}`, () => {
    const s = new THREE.Shape()
    s.moveTo(-w / 2, 0)
    s.lineTo(w / 2, 0)
    s.lineTo(0, rise)
    s.closePath()
    const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false })
    g.translate(0, 0, -thick / 2)
    return g
  })
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export type CanopyOpts = {
  seed: number
  deep: string
  mid: string
  light: string
  flower?: string
  flowerAmt?: number
  detail?: number
  /** How flat the underside of each blob is (fraction of radius). */
  flat?: number
}

/**
 * Stylized foliage / cloud mass: lumpy blobs merged into one mesh, with
 * painted vertex colors (deep underneath → light on top). Smooth-shaded —
 * never faceted (design.md §12: no low-poly).
 */
export function canopyGeo(blobs: number[][], o: CanopyOpts) {
  const key = `cn|${o.seed}|${o.deep}|${o.mid}|${o.light}|${o.flower ?? ''}|${o.detail ?? 4}|${o.flat ?? 0.3}|${blobs.length}`
  return cached(key, () => {
    const r = rng(o.seed)
    const parts: THREE.BufferGeometry[] = []
    for (const [bx, by, bz, rad] of blobs) {
      let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(rad, o.detail ?? 4)
      g.deleteAttribute('normal')
      g.deleteAttribute('uv')
      g = mergeVertices(g)
      const pos = g.getAttribute('position') as THREE.BufferAttribute
      const ph = r() * 100
      const fl = -rad * (o.flat ?? 0.3)
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i)
        let y = pos.getY(i)
        let z = pos.getZ(i)
        const n =
          1 +
          0.1 * Math.sin((x / rad) * 3.1 + ph) * Math.sin((y / rad) * 2.7 + ph * 0.7) * Math.sin((z / rad) * 3.3 + ph * 1.3) +
          0.045 * Math.sin((x / rad) * 7 + (y / rad) * 5 + ph)
        x *= n
        y *= n
        z *= n
        if (y < fl) y = fl + (y - fl) * 0.35
        pos.setXYZ(i, x + bx, y + by, z + bz)
      }
      g.computeVertexNormals()
      parts.push(g)
    }
    const leaves = mergeGeometries(parts)!
    parts.forEach((p) => p.dispose())
    leaves.computeBoundingBox()
    const { min, max } = leaves.boundingBox!
    const cd = new THREE.Color(o.deep)
    const cm = new THREE.Color(o.mid)
    const cl = new THREE.Color(o.light)
    const c = new THREE.Color()
    paint(leaves, (y, ny) => {
      const t = (y - min.y) / Math.max(0.001, max.y - min.y)
      return c
        .copy(cd)
        .lerp(cm, smooth(0.05, 0.5, t))
        .lerp(cl, Math.min(1, smooth(0.5, 1, t) * 0.7 + Math.max(0, ny) * 0.3 * t))
    })
    if (!o.flower) return leaves

    // Blossoms: chunky little clusters sitting on the upper canopy surface.
    const cf = new THREE.Color(o.flower)
    const cfDark = cf.clone().multiplyScalar(0.7)
    const cfLight = cf.clone().lerp(new THREE.Color('#FFF1D6'), 0.25)
    const blooms: THREE.BufferGeometry[] = []
    const per = Math.round(24 * (o.flowerAmt ?? 1))
    for (const [bx, by, bz, rad] of blobs) {
      for (let k = 0; k < per; k++) {
        const a = r() * Math.PI * 2
        const up = 0.05 + r() * 0.95
        const dir = new THREE.Vector3(Math.cos(a) * Math.sqrt(1 - up * up), up, Math.sin(a) * Math.sqrt(1 - up * up))
        let b: THREE.BufferGeometry = new THREE.IcosahedronGeometry(rad * (0.07 + r() * 0.05), 1)
        b.deleteAttribute('normal')
        b.deleteAttribute('uv')
        b = mergeVertices(b)
        b.computeVertexNormals()
        b.translate(bx + dir.x * rad * 0.97, by + dir.y * rad * 0.97, bz + dir.z * rad * 0.97)
        blooms.push(b)
      }
    }
    const flowers = mergeGeometries(blooms)!
    blooms.forEach((b) => b.dispose())
    paint(flowers, (_, ny) => c.copy(cfDark).lerp(cf, 0.55 + 0.45 * Math.max(0, ny)).lerp(cfLight, Math.max(0, ny - 0.6)))
    const out = mergeGeometries([leaves, flowers])!
    leaves.dispose()
    flowers.dispose()
    return out
  })
}

/** Bake per-vertex colours (and blank UVs, for merge compatibility). */
function paint(g: THREE.BufferGeometry, color: (y: number, ny: number) => THREE.Color) {
  const pos = g.getAttribute('position')
  const nor = g.getAttribute('normal')
  const cols = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const col = color(pos.getY(i), nor.getY(i))
    cols[i * 3] = col.r
    cols[i * 3 + 1] = col.g
    cols[i * 3 + 2] = col.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2))
}

export function sphere(r: number, w = 16, h = 12) {
  return cached(`sp|${f(r)}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h))
}
