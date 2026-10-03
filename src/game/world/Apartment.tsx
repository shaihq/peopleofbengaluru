'use client'

import { C } from '@/lib/palette'
import { APARTMENT, BASE } from '../layout'
import { Building } from './Building'
import { Box, Sign } from './kit'
import { CompoundWall } from './CompoundWall'

/** Srinivasa Residency — stilt-parking apartment block with a compound wall. */
export function Apartment() {
  return (
    <>
      <Building {...APARTMENT} />
      <CompoundWall from={[-24, -8.4]} to={[-18.2, -8.4]} />
      <CompoundWall from={[-14.8, -8.4]} to={[-8.4, -8.4]} />
      <CompoundWall from={[-8.4, -8.4]} to={[-8.4, -24]} />
      {/* gate pillars */}
      {[-18.2, -14.8].map((x) => (
        <group key={x} position={[x, BASE, -8.4]}>
          <Box s={[0.6, 1.9, 0.6]} p={[0, 0.95, 0]} c={C.WALL_WHITE} />
          <Box s={[0.75, 0.14, 0.75]} p={[0, 1.95, 0]} c={C.TERRACOTTA} />
        </group>
      ))}
      <Sign
        p={[-19.7, BASE + 0.95, -8.24]}
        w={2.2}
        h={0.82}
        spec={{ title: 'SRINIVASA RESIDENCY', kn: 'ಶ್ರೀನಿವಾಸ ರೆಸಿಡೆನ್ಸಿ', bg: C.WALL_WHITE, fg: C.SIGN_RED }}
        frame={C.TERRACOTTA}
        depth={0.08}
      />
    </>
  )
}
