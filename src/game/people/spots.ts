// Places in the district where a real person can choose to hang out.
// Each slot is [x, z, facing]; hand-placed clear of props and the sample cast.

export type SpotId = 'darshini' | 'shops' | 'park' | 'busstop' | 'coconut' | 'peepal' | 'residency' | 'junction'

export const SPOTS: Record<SpotId, { label: string; blurb: string; slots: [number, number, number][] }> = {
  darshini: {
    label: 'NAMMA DARSHINI',
    blurb: 'Filter coffee at the standing tables',
    slots: [
      [18, -5.85, Math.PI],
      [18.65, -7.0, -0.9],
      [16.6, -9.6, Math.PI],
      [12.4, -9.6, Math.PI],
    ],
  },
  shops: {
    label: '80 FEET ROAD',
    blurb: 'Outside the shops on the main road',
    slots: [
      [33.0, -6.3, Math.PI],
      [35.6, -6.4, Math.PI - 0.3],
      [43.4, -6.3, Math.PI],
      [39.2, -6.2, Math.PI + 0.3],
    ],
  },
  park: {
    label: '5TH BLOCK PARK',
    blurb: 'Under the rain tree',
    slots: [
      [16.0, 15.6, 0],
      [24.0, 20.0, -Math.PI / 2],
      [16.0, 25.0, Math.PI],
      [22.5, 17.0, -2.4],
    ],
  },
  busstop: {
    label: 'BUS STOP',
    blurb: 'Waiting for the 500D',
    slots: [
      [25.2, 5.6, Math.PI],
      [23.0, 5.6, Math.PI - 0.3],
      [27.4, 6.4, Math.PI + 0.4],
    ],
  },
  coconut: {
    label: 'COCONUT CART',
    blurb: 'Tender coconut break',
    slots: [
      [5.75, 17.0, 0.5],
      [7.5, 16.8, -0.5],
      [6.0, 15.7, 0.2],
    ],
  },
  peepal: {
    label: 'PEEPAL LABS',
    blurb: 'At the startup house gate',
    slots: [
      [-17.4, 7.3, Math.PI],
      [-13.9, 7.7, Math.PI + 0.3],
      [-19.0, 7.0, Math.PI - 0.2],
    ],
  },
  residency: {
    label: 'SRINIVASA RESIDENCY',
    blurb: 'Outside the apartment gate',
    slots: [
      [-14.0, -6.9, 0.3],
      [-18.9, -7.0, -0.3],
      [-11.5, -6.6, 0],
    ],
  },
  junction: {
    label: '5TH BLOCK JUNCTION',
    blurb: 'Right at the crossroads',
    slots: [
      [6.6, 9.4, -2.4],
      [-6.6, -9.4, 0.7],
      [6.6, -9.4, -0.7],
      [-6.6, 9.6, 2.4],
    ],
  },
}

export const SPOT_IDS = Object.keys(SPOTS) as SpotId[]

export const NEIGHBOURHOODS = [
  'Koramangala',
  'Indiranagar',
  'HSR Layout',
  'Whitefield',
  'Jayanagar',
  'JP Nagar',
  'BTM Layout',
  'Bellandur',
  'Malleshwaram',
  'Hebbal',
  'Frazer Town',
  'Electronic City',
  'Elsewhere',
]
