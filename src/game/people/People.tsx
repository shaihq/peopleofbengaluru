'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { usePeople } from './directory'
import { Person } from './Person'
import { declutter } from './plates'

export function People() {
  const size = useThree((s) => s.size)
  const people = usePeople()
  // Runs after every <Person/> has posted its plate request this frame.
  useFrame(() => declutter(size.width, size.height))
  return (
    <>
      {people.map((p) => (
        <Person key={p.id} p={p} />
      ))}
    </>
  )
}
