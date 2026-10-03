'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { PEOPLE } from './profiles'
import { Person } from './Person'
import { declutter } from './plates'

export function People() {
  const size = useThree((s) => s.size)
  // Runs after every <Person/> has posted its plate request this frame.
  useFrame(() => declutter(size.width, size.height))
  return (
    <>
      {PEOPLE.map((p) => (
        <Person key={p.id} p={p} />
      ))}
    </>
  )
}
