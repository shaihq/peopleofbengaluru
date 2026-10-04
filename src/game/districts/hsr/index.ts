import { registerDistrict, type Surface } from '../active'
import { BREW_LAB, HSR_PORTAL, HSR_TREES, MAIN, MEDIAN, MEDIAN_GAP, SECTOR_PARK, SHIP_CLUB, SIDE, hsrColliders, hsrGround } from './layout'

// HSR Layout, Sector 2 — the Builder / Indie district.

function surface(x: number, z: number): Surface {
  if (Math.abs(z) < MEDIAN && Math.abs(x) > MEDIAN_GAP) return 'grass'
  if (Math.abs(z) < MAIN || (z < -MAIN && Math.abs(x) < SIDE)) return 'asphalt'
  if (x > SECTOR_PARK.x0 && x < SECTOR_PARK.x1 && z > SECTOR_PARK.z0 && z < SECTOR_PARK.z1) {
    const onPath = (Math.abs(x - 27.5) < 0.8 && z < 18) || (Math.abs(z - 18.4) < 0.8 || Math.abs(z - 30.4) < 0.8) || Math.abs(x - 19.5) < 0.8 || Math.abs(x - 35.5) < 0.8
    return onPath ? 'pavers' : 'grass'
  }
  if (Math.abs(x - SHIP_CLUB.x) < 7 && z > 10 && z < 12.8) return 'kota' // timber deck
  if (Math.hypot(x - HSR_PORTAL.x, z - HSR_PORTAL.z) < 3.4) return 'kota'
  return 'pavers'
}

registerDistrict({
  id: 'hsr',
  colliders: hsrColliders,
  ground: (x, z) => hsrGround(x, z) + (Math.hypot(x - HSR_PORTAL.x, z - HSR_PORTAL.z) < 3.4 ? 0.1 : 0),
  surface,
  landmarks: [
    { x: HSR_PORTAL.x, z: HSR_PORTAL.z, r: 6, label: 'PORTAL PLAZA' },
    { x: SHIP_CLUB.x, z: 11, r: 8.5, label: 'SHIP CLUB' },
    { x: BREW_LAB.x, z: 11, r: 7.5, label: 'BREW LAB' },
    { x: 27, z: 10.5, r: 9, label: 'THE MURAL WALL' },
    { x: 27.5, z: 24, r: 10, label: 'SECTOR 2 PARK' },
    { x: 20, z: -11, r: 8, label: 'MALNAD MESS' },
    { x: 0, z: -24, r: 12, label: '19TH CROSS' },
    { x: 0, z: 0, r: 46, label: '27TH MAIN ROAD' },
  ],
  area: 'SECTOR 2',
  spawn: { x: HSR_PORTAL.x, z: 14.6, face: Math.PI },
  portal: HSR_PORTAL,
  arrival: { x: HSR_PORTAL.x, z: HSR_PORTAL.z - 6.5, face: Math.PI },
  spots: {
    'hsr-shipclub': { label: 'SHIP CLUB', blurb: 'On the co-working deck', slots: [[-19, 9.8, Math.PI], [-14, 9.8, Math.PI + 0.3], [-21, 10.4, Math.PI - 0.4]] },
    'hsr-brewlab': { label: 'BREW LAB', blurb: 'Coffee on the terrace', slots: [[-36, 9.4, Math.PI], [-32, 9.4, Math.PI + 0.3], [-39.5, 11.2, Math.PI / 2]] },
    'hsr-mural': { label: 'THE MURAL WALL', blurb: 'In front of "Build in Public"', slots: [[20, 10.6, 0], [33, 10.6, 0.3], [24, 10.5, -0.3]] },
    'hsr-park': { label: 'SECTOR 2 PARK', blurb: 'Under the rain tree', slots: [[22.5, 20, -0.6], [31, 28.5, 2.4], [26, 22.8, 0.2]] },
    'hsr-mess': { label: 'MALNAD MESS', blurb: 'Lunch on 27th Main', slots: [[20.5, -10.2, 0], [14, -10.2, 0.3], [26.5, -10.2, -0.3]] },
    'hsr-cross': { label: '19TH CROSS', blurb: 'Under the avenue trees', slots: [[-6.6, -20, Math.PI / 2], [6.6, -30, -Math.PI / 2], [6.6, -18, -Math.PI / 2]] },
  },
  breaks: [
    // (face = the way they look: at the café counter / shop front)
    ...[-38, -34, -30].map((x) => ({ x, z: 9.3, face: 0 })),
    { x: 20, z: -10.1, face: Math.PI },
    { x: 14, z: -10.1, face: Math.PI },
    { x: 26, z: -10.1, face: Math.PI },
    { x: -16, z: 9.7, face: 0 },
  ],
  trees: HSR_TREES.filter((t) => t.kind === 'rain').map((t) => ({ x: t.x, z: t.z })),
  radio: [BREW_LAB.x, 2.4, BREW_LAB.z + 1],
  orbit: [0, 3, 8],
})
