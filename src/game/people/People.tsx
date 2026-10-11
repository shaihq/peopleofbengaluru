'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { usePeople } from './directory'
import { homeDistrict } from '../districts/registry'
import { useGame } from '../store'
import { Person } from './Person'
import { declutter } from './plates'
import { resetWanderBudget } from './wander'
import { useNet } from '../net/useNet'

export function People() {
  const size = useThree((s) => s.size)
  const district = useGame((s) => s.district)
  const live = useNet((s) => s.live)
  const online = useNet((s) => s.online)
  // the people who live in the loaded district (unless they're live somewhere else right now),
  // plus members from elsewhere who are live here
  const people = usePeople().filter((p) =>
    homeDistrict(p.location) === district ? live.has(p.id) || !online[p.id] || online[p.id] === district : live.has(p.id),
  )
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
