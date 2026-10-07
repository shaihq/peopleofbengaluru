'use client'

import * as THREE from 'three'
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { active } from '../districts/active'
import { bodies, player } from '../people/bodies'
import { useGame } from '../store'

/**
 * Walk up to the portal → a "[E] TRAVEL" prompt appears (see Interaction.tsx); the
 * "WHERE TO?" picker only opens when you choose to.
 * If you were heading to the portal to reach someone (finder), you go straight through.
 */
const NEAR = 3.2 // prompt appears inside this…
const FAR = 3.9 // …and stays until you're past this (no flicker at the edge)

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
    if (g.portalFor && armed.current && d < 1.0 && !g.portalOpen && !g.openId && !g.searchOpen && !g.statusOpen && !g.paused) {
      armed.current = false
      g.startTravel(g.portalFor.district, g.portalFor.id)
      return
    }

    const near = g.nearPortal ? d < FAR : d < NEAR
    if (near !== g.nearPortal) g.setNearPortal(near)
  })

  return null
}
