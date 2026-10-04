'use client'

import { useGame } from '../store'
import { World as KoramangalaWorld } from './World'
import { HSRWorld } from '../districts/hsr/World'

/** Only the active district is mounted — travelling unmounts the old one. */
export function DistrictWorld() {
  const district = useGame((s) => s.district)
  if (district === 'hsr') return <HSRWorld key="hsr" />
  return <KoramangalaWorld key="koramangala" />
}
