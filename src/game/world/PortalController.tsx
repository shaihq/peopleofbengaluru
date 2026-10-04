'use client'

import * as THREE from 'three'
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { active } from '../districts/active'
import { bodies, player } from '../people/bodies'
import { useGame } from '../store'

/**
 * Walk into the portal → the "WHERE TO?" picker opens.
 * If you were heading to the portal to reach someone (finder), you go straight through.
 */
export function PortalController() {
  const district = useGame((s) => s.district)
  const armed = useRef(true)
  const target = useRef(new THREE.Vector3())

  // the portal is a travel target for the auto-walk (not a person)
  useEffect(() => {
    const p = active.def.portal
    target.current.set(p.x, 0.15, p.z)
    bodies.set('portal', target.current)
    armed.current = false // you arrive standing next to it — step away first
    return () => {
      bodies.delete('portal')
    }
  }, [district])

  useFrame(() => {
    const g = useGame.getState()
    const me = player.pos
    if (!me || g.phase !== 'play' || g.travel) return
    const p = active.def.portal
    const d = Math.hypot(me.x - p.x, me.z - p.z)

    // finder route: arrived at the portal → straight through to them
    if (g.portalFor && g.trackId === 'portal' && g.trackStage === 'found') {
      g.startTravel(g.portalFor.district, g.portalFor.id)
      return
    }
    if (d > 2.8) armed.current = true
    if (armed.current && d < 1.0 && !g.portalOpen && !g.openId && !g.searchOpen && !g.paused) {
      armed.current = false
      if (g.portalFor) g.startTravel(g.portalFor.district, g.portalFor.id)
      else g.setPortalOpen(true)
    }
  })

  return null
}
