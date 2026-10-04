'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { usePeople } from './directory'
import { homeDistrict } from '../districts/registry'
import { useGame } from '../store'
import { Person } from './Person'
import { declutter } from './plates'
import { resetWanderBudget } from './wander'

export function People() {
  const size = useThree((s) => s.size)
  const district = useGame((s) => s.district)
  // only the people who live in (or are visiting) the loaded district
  const people = usePeople().filter((p) => homeDistrict(p.location) === district)
  // Runs after every <Person/> has posted its plate request this frame.
  useFrame(() => {
    declutter(size.width, size.height)
    resetWanderBudget()
  })
  return (
    <>
      {people.map((p) => (
        <Person key={`${district}:${p.id}`} p={p} />
      ))}
    </>
  )
}
