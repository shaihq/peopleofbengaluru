'use client'

import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { groundHeight } from '../layout'
import { route } from '../tracking'

const MAX = 90
const SPACING = 0.9

/** Marching saffron dots along the route to whoever you're tracking. */
export function Trail() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const geo = useMemo(() => new THREE.CircleGeometry(0.15, 16).rotateX(-Math.PI / 2), [])
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#FFB020', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }),
    [],
  )
  const m = useMemo(() => new THREE.Matrix4(), [])

  useFrame((state) => {
    const path = route.path
    let n = 0
    if (path.length > 1) {
      let carry = SPACING - ((state.clock.elapsedTime * 1.8) % SPACING)
      let travelled = 0
      for (let i = 0; i < path.length - 1 && n < MAX; i++) {
        const [ax, az] = path[i]
        const [bx, bz] = path[i + 1]
        const len = Math.hypot(bx - ax, bz - az)
        let d = carry
        while (d < len && n < MAX) {
          const t = d / len
          const x = ax + (bx - ax) * t
          const z = az + (bz - az) * t
          const along = travelled + d
          // grow in from the player's feet
          const s = THREE.MathUtils.smoothstep(along, 0.6, 2.2)
          m.makeScale(s, 1, s).setPosition(x, groundHeight(x, z) + 0.045, z)
          ref.current.setMatrixAt(n++, m)
          d += SPACING
        }
        carry = d - len
        travelled += len
      }
    }
    ref.current.count = n
    ref.current.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[geo, mat, MAX]} frustumCulled={false} renderOrder={3} />
}
