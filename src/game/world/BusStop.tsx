'use client'

import { C } from '@/lib/palette'
import { BASE, BUS_STOP } from '../layout'
import { Box, Sign } from './kit'

const STEEL = { c: C.GRILLE, rough: 0.45, metal: 0.45, grade: false }

/** BMTC bus shelter. Local +Z faces the road. */
export function BusStop() {
  const { x, z, rot } = BUS_STOP
  return (
    <group position={[x, BASE, z]} rotation={[0, rot, 0]}>
      <Box s={[4.8, 0.12, 2.0]} p={[0, 0.06, 0]} c={C.CONCRETE_AGED} />
      {[-2.1, 2.1].map((px) => (
        <group key={px}>
          <Box s={[0.12, 2.65, 0.12]} p={[px, 1.37, -0.8]} {...STEEL} />
          <Box s={[0.1, 2.55, 0.1]} p={[px, 1.33, 0.75]} {...STEEL} />
        </group>
      ))}
      {/* roof */}
      <Box s={[5.2, 0.16, 2.4]} p={[0, 2.72, 0]} r={[-0.05, 0, 0]} c={C.BMTC_BLUE} rough={0.5} metal={0.2} grade={false} />
      <Box s={[5.2, 0.08, 2.5]} p={[0, 2.84, 0]} r={[-0.05, 0, 0]} c={C.WALL_WHITE} rough={0.6} grade={false} />
      <Sign
        p={[0, 3.18, 1.08]}
        w={3.4}
        h={0.62}
        spec={{ title: 'BUS STOP', kn: 'ಬಸ್ ನಿಲ್ದಾಣ', bg: C.BMTC_BLUE, fg: '#FFF6E5' }}
        frame={C.WALL_WHITE}
        depth={0.08}
      />
      {/* back panel with route board */}
      <Box s={[4.2, 1.7, 0.06]} p={[0, 1.15, -0.82]} c={C.STEEL} rough={0.45} metal={0.35} grade={false} />
      <Sign
        p={[1.1, 1.35, -0.76]}
        w={1.6}
        h={1.2}
        spec={{ title: '500D  201  335E', kn: 'ಮಾರ್ಗಗಳು', sub: 'SILK BOARD · MAJESTIC · HSR', bg: C.WALL_WHITE, fg: C.BMTC_BLUE }}
        frame={C.BMTC_BLUE}
        depth={0.04}
      />
      {/* bench */}
      <Box s={[3.2, 0.08, 0.45]} p={[-0.3, 0.5, -0.5]} c={C.STEEL} rough={0.35} metal={0.55} grade={false} />
      {[-1.6, 1.0].map((bx) => (
        <Box key={bx} s={[0.08, 0.45, 0.4]} p={[bx, 0.27, -0.5]} {...STEEL} />
      ))}
    </group>
  )
}
