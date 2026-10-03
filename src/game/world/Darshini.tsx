'use client'

import { C } from '@/lib/palette'
import { BASE, CAFE } from '../layout'
import { mat } from '../materials'
import { torus } from '../geometry'
import { Awning, Box, Cyl, Parapet, Sign, Tank, Mumty, Win } from './kit'

const G = 4.2 // ground floor height
const U = 3.2 // upper floor height

/**
 * Namma Darshini — the corner tiffin café and the social hub of the block.
 * Open-fronted ground floor with a steel counter, standing tables on the pavement.
 * Local +Z faces 80 Feet Road.
 */
export function Darshini() {
  const { x, z, rot, w, d } = CAFE
  const H = G + U
  const front = d / 2
  return (
    <group position={[x, BASE, z]} rotation={[0, rot, 0]}>
      {/* kitchen block (back of ground floor) */}
      <Box s={[w, G, 5.5]} p={[0, G / 2, -d / 2 + 2.75]} c={C.WALL_MINT} />
      {/* open front: side walls, pillar, fascia, ceiling, floor */}
      <Box s={[0.4, G, 3.5]} p={[-w / 2 + 0.2, G / 2, 2.75]} c={C.WALL_WHITE} />
      <Box s={[0.4, G, 3.5]} p={[w / 2 - 0.2, G / 2, 2.75]} c={C.WALL_WHITE} />
      <Box s={[0.5, 3.0, 0.5]} p={[0, 1.5, front - 0.3]} c={C.TERRACOTTA} />
      <Box s={[w, G - 3.0, 0.5]} p={[0, 3.0 + (G - 3) / 2, front - 0.25]} c={C.TERRACOTTA} />
      <Box s={[w, 0.3, 3.5]} p={[0, G - 0.15, 2.75]} c={C.WALL_WHITE} />
      <Box s={[w - 0.8, 0.06, 3.4]} p={[0, 0.03, 2.8]} c={C.KOTA} grade={false} shadow={false} />

      {/* upper floor */}
      <Box s={[w, U, d]} p={[0, G + U / 2, 0]} c={C.WALL_WHITE} />
      <Box s={[w + 0.24, 0.24, d + 0.24]} p={[0, G, 0]} c={C.TERRACOTTA} />
      {[-3.4, 0, 3.4].map((wx, i) => (
        <Win key={wx} p={[wx, G + 1.65, front]} frame={C.TERRACOTTA} shadeColor={C.TERRACOTTA} curtain={i === 1 ? C.WALL_BUTTER : null} />
      ))}
      {[-3.4, 0, 3.4].map((wx) => (
        <Win key={wx} p={[wx, G + 1.65, -front]} r={[0, Math.PI, 0]} frame={C.TERRACOTTA} />
      ))}
      {[-2.2, 2.2].map((wz) => (
        <Win key={wz} p={[-w / 2, G + 1.65, wz]} r={[0, -Math.PI / 2, 0]} frame={C.TERRACOTTA} shadeColor={C.TERRACOTTA} grille />
      ))}
      {[-2.2, 2.2].map((wz) => (
        <Win key={wz} p={[w / 2, G + 1.65, wz]} r={[0, Math.PI / 2, 0]} frame={C.TERRACOTTA} />
      ))}
      <Parapet w={w} d={d} wall={C.WALL_WHITE} trim={C.TERRACOTTA} y={H} />
      <Tank p={[3, H, -2]} />
      <Mumty p={[-3, H, -2.4]} wall={C.WALL_WHITE} trim={C.TERRACOTTA} />

      {/* signboard + awning */}
      <Sign
        p={[0, 3.6, front + 0.15]}
        w={10}
        h={1.05}
        spec={{ title: 'NAMMA DARSHINI', kn: 'ನಮ್ಮ ದರ್ಶಿನಿ', sub: 'FILTER COFFEE · IDLI · VADA · DOSA', bg: C.KERB_YELLOW, fg: C.SIGN_RED }}
        frame={C.SIGN_RED}
      />
      <Awning p={[0, 2.98, front]} w={10.4} depth={1.7} a={C.WALL_WHITE} b={C.TERRACOTTA} />

      {/* painted wall ad on the side street */}
      <Sign
        p={[-w / 2 - 0.01, 1.9, -1.9]}
        r={[0, -Math.PI / 2, 0]}
        w={4.4}
        h={1.7}
        spec={{ title: 'FILTER KAAPI', kn: 'ಫಿಲ್ಟರ್ ಕಾಫಿ', sub: 'STRONG · HOT · SINCE 1987', bg: C.SIGN_RED, fg: C.WALL_BUTTER }}
        frame={C.WALL_MINT}
        depth={0.04}
      />

      {/* interior: menu board, kitchen door, counter */}
      <Sign
        p={[-1.2, 2.45, 1.0]}
        w={4.2}
        h={1.3}
        spec={{ title: 'IDLI · VADA · DOSA', kn: 'ಇಂದಿನ ತಿಂಡಿ', sub: 'COFFEE ₹20   TEA ₹15', bg: '#2F4A3A', fg: '#FFF6E5' }}
        frame={C.WOOD}
        depth={0.06}
      />
      <Box s={[1.1, 2.3, 0.08]} p={[3.8, 1.15, 1.02]} c="#3A2E28" rough={0.9} grade={false} />
      <Box s={[6, 1.0, 0.7]} p={[0, 0.5, 1.65]} c={C.STEEL} metal={0.6} rough={0.35} grade={false} />
      <Box s={[6.2, 0.08, 0.82]} p={[0, 1.04, 1.65]} c="#3B3A3E" rough={0.3} grade={false} />
      {/* coffee urn */}
      <Cyl rt={0.3} rb={0.34} h={0.8} p={[-2.2, 1.48, 1.6]} c={C.STEEL} metal={0.75} rough={0.22} grade={false} />
      <Cyl rt={0.12} rb={0.3} h={0.16} p={[-2.2, 1.96, 1.6]} c={C.STEEL} metal={0.75} rough={0.22} grade={false} />
      {/* tumbler stacks */}
      {[-1.2, -0.95, -0.7].map((tx) => (
        <Cyl key={tx} rt={0.06} rb={0.05} h={0.26} p={[tx, 1.21, 1.75]} c={C.STEEL} metal={0.75} rough={0.25} grade={false} shadow={false} />
      ))}
      {/* tray of vadas */}
      <Cyl rt={0.42} h={0.04} p={[1.4, 1.1, 1.6]} c={C.STEEL} metal={0.7} rough={0.3} grade={false} />
      {[
        [1.25, 1.5],
        [1.55, 1.48],
        [1.4, 1.75],
        [1.2, 1.72],
        [1.6, 1.72],
      ].map(([vx, vz], i) => (
        <mesh
          key={i}
          geometry={torus(0.075, 0.04)}
          material={mat('#C98A3A', { rough: 0.7, grade: false })}
          position={[vx, 1.16, vz]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      ))}

      {/* standing tables on the pavement */}
      {[-3.5, 0, 3.5].map((tx) => (
        <group key={tx} position={[tx, 0, front + 1.5]}>
          <Cyl rt={0.3} h={0.04} p={[0, 0.02, 0]} c={C.STEEL} metal={0.6} rough={0.35} grade={false} />
          <Cyl rt={0.055} h={1.05} p={[0, 0.54, 0]} c={C.STEEL} metal={0.6} rough={0.35} grade={false} />
          <Cyl rt={0.42} h={0.05} p={[0, 1.08, 0]} c={C.STEEL} metal={0.6} rough={0.3} grade={false} />
        </group>
      ))}
    </group>
  )
}
