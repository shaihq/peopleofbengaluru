'use client'

import * as THREE from 'three'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * The city is authored as thousands of small kit pieces. Once mounted, this
 * bakes every static mesh into one merged mesh per material, so the GPU sees
 * a few dozen draw calls instead of thousands.
 */
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
      const key = `${m.material.uuid}|${m.castShadow}`
      let g = groups.get(key)
      if (!g) {
        g = { mat: m.material, cast: m.castShadow, geos: [] }
        groups.set(key, g)
      }
      const geo = m.geometry.clone()
      geo.applyMatrix4(tmp.multiplyMatrices(inv, m.matrixWorld))
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
