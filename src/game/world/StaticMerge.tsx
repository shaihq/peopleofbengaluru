'use client'

import * as THREE from 'three'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { applyGroundGrade } from '../materials'

/**
 * The city is authored as thousands of small kit pieces. Once mounted, this
 * bakes every static mesh into one merged mesh per material PER CHUNK of the map,
 * so the GPU sees a few hundred draw calls instead of thousands — and, because each
 * chunk is small, everything behind the camera or outside the sun's shadow box is
 * skipped instead of drawn every frame.
 */
const CHUNK = 45 // metres

/**
 * Plain painted materials differ only by colour. Those are baked into vertex colours
 * and share one material per surface type, so a chunk costs a handful of draws
 * instead of one per paint colour.
 */
function surfaceKey(m: THREE.Material): string | null {
  const s = m as THREE.MeshStandardMaterial
  if (s.type !== 'MeshStandardMaterial' || s.map || s.emissiveMap || s.vertexColors || s.transparent || s.opacity < 1) return null
  if (s.emissive.getHex() !== 0 || !s.depthWrite || s.polygonOffset) return null
  const painted = s.customProgramCacheKey() === 'painted-surface'
  return `surface|${s.roughness}|${s.metalness}|${s.envMapIntensity}|${s.side}|${s.flatShading}|${painted}`
}
const surfaces = new Map<string, THREE.MeshStandardMaterial>()
function surfaceMaterial(key: string, like: THREE.MeshStandardMaterial) {
  let m = surfaces.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: like.roughness,
      metalness: like.metalness,
      envMapIntensity: like.envMapIntensity,
      side: like.side,
      flatShading: like.flatShading,
    })
    if (like.customProgramCacheKey() === 'painted-surface') applyGroundGrade(m)
    surfaces.set(key, m)
  }
  return m
}
// Dev-only: every kit piece's bounds before merging, for finding coplanar faces that z-fight.
type Piece = { box: THREE.Box3; mat: string; color: string; aligned: boolean; type: string; normal?: number[]; tris: number }
const debugPieces: Piece[] | null =
  process.env.NODE_ENV !== 'production' && typeof window !== 'undefined'
    ? (((window as unknown as { __dobPieces?: Piece[] }).__dobPieces = []) as Piece[])
    : null

export function StaticMerge({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null!)
  const [merged, setMerged] = useState<THREE.Mesh[]>([])

  useLayoutEffect(() => {
    const root = ref.current
    root.updateMatrixWorld(true)
    const inv = root.matrixWorld.clone().invert()
    const tmp = new THREE.Matrix4()
    const groups = new Map<string, { mat: THREE.Material; cast: boolean; geos: THREE.BufferGeometry[] }>()
    const sources: THREE.Object3D[] = []

    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || (m as THREE.SkinnedMesh).isSkinnedMesh) return
      if (Array.isArray(m.material) || m.userData.noMerge) return
      m.geometry.boundingSphere ?? m.geometry.computeBoundingSphere()
      const center = m.geometry.boundingSphere!.center.clone().applyMatrix4(m.matrixWorld)
      // huge pieces (ground, roads) stay whole; everything else goes to its map chunk
      const big = m.geometry.boundingSphere!.radius * m.matrixWorld.getMaxScaleOnAxis() > CHUNK
      const cell = big ? 'all' : `${Math.floor(center.x / CHUNK)},${Math.floor(center.z / CHUNK)}`
      const surface = surfaceKey(m.material)
      const key = `${surface ?? m.material.uuid}|${m.castShadow}|${cell}`
      let g = groups.get(key)
      if (!g) {
        const mat = surface ? surfaceMaterial(surface, m.material as THREE.MeshStandardMaterial) : m.material
        g = { mat, cast: m.castShadow, geos: [] }
        groups.set(key, g)
      }
      const geo = m.geometry.clone()
      geo.applyMatrix4(tmp.multiplyMatrices(inv, m.matrixWorld))
      if (surface) {
        // bake this piece's paint colour into its vertices (linear, like material.color)
        const col = (m.material as THREE.MeshStandardMaterial).color
        const n = geo.getAttribute('position').count
        const arr = new Float32Array(n * 3)
        for (let i = 0; i < n; i++) (arr[i * 3] = col.r), (arr[i * 3 + 1] = col.g), (arr[i * 3 + 2] = col.b)
        geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
      }
      if (debugPieces) {
        geo.computeBoundingBox()
        const e = m.matrixWorld.elements
        const axisAligned = [e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]].every((v) => Math.abs(v) < 1e-4 || Math.abs(Math.abs(v) - 1) < 1e-4)
        const c = (m.material as THREE.MeshStandardMaterial).color
        const normal = m.geometry.type === 'PlaneGeometry' ? new THREE.Vector3(0, 0, 1).transformDirection(m.matrixWorld).toArray().map(Math.round) : undefined
        debugPieces.push({ box: geo.boundingBox!.clone(), mat: m.material.uuid, color: c ? '#' + c.getHexString() : '?', aligned: axisAligned, type: m.geometry.type, normal, tris: (geo.index ? geo.index.count : geo.getAttribute('position').count) / 3 })
      }
      g.geos.push(geo)
      sources.push(m)
    })

    const out: THREE.Mesh[] = []
    for (const g of groups.values()) {
      const hasColor = g.geos.every((x) => x.getAttribute('color'))
      const keep = new Set(['position', 'normal', 'uv', ...(hasColor ? ['color'] : [])])
      let geos = g.geos.map((x) => {
        for (const name of Object.keys(x.attributes)) if (!keep.has(name)) x.deleteAttribute(name)
        if (!x.getAttribute('uv')) x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(x.getAttribute('position').count * 2), 2))
        x.morphAttributes = {}
        x.clearGroups()
        return x
      })
      if (geos.some((x) => !x.index)) geos = geos.map((x) => (x.index ? x.toNonIndexed() : x))
      const geo = mergeGeometries(geos, false)
      g.geos.forEach((x) => x.dispose())
      if (!geo) continue
      geo.computeBoundingSphere()
      const mesh = new THREE.Mesh(geo, g.mat)
      mesh.castShadow = g.cast
      mesh.receiveShadow = true
      mesh.matrixAutoUpdate = false
      out.push(mesh)
    }

    for (const s of sources) {
      s.visible = false
      s.matrixAutoUpdate = false
    }
    setMerged(out)
    return () => {
      for (const s of sources) s.visible = true
      out.forEach((m) => m.geometry.dispose())
    }
  }, [])

  return (
    <>
      <group ref={ref}>{children}</group>
      {merged.map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
    </>
  )
}
