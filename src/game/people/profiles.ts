// SAMPLE PROFILES — fictional people and companies, for prototyping only.
// Replace with real, consented designer profiles before sharing publicly.

export type Profile = {
  id: string
  name: string
  role: string
  company: string
  /** Where in Bengaluru they say they're from (not where they stand in the scene). */
  location: string
  building?: string
  previously?: string
  openToWork: boolean
  skills: string[]
  links: { portfolio?: string; linkedin?: string; x?: string }
  /** Character style from the roster. */
  character: string
  /** Where they spend time in the district. Either a fixed spot or a looping walk. */
  spot?: { x: number; z: number; face: number }
  path?: [number, number][]
  pause?: number
}

const PI = Math.PI

export const PEOPLE: Profile[] = [
  {
    id: 'ananya',
    name: 'ANANYA RAO',
    role: 'Product Designer',
    company: 'Kettle',
    location: 'Koramangala',
    building: 'Doodle Desk',
    previously: 'Hopscotch',
    skills: ['Figma', 'Prototyping', 'Fintech'],
    openToWork: false,
    links: {},
    character: 'designer',
    spot: { x: 11, z: -5.85, face: PI },
  },
  {
    id: 'priya',
    name: 'PRIYA NAIR',
    role: 'Founder',
    company: 'Thali Studio',
    location: 'Indiranagar',
    building: 'Thali — a design system for Indic apps',
    skills: ['Design systems', 'Indic typography', 'Hiring'],
    openToWork: false,
    links: {},
    character: 'founder',
    spot: { x: 14.0, z: -5.95, face: PI - 0.5 },
  },
  {
    id: 'nikhil',
    name: 'NIKHIL JOSHI',
    role: 'Partner',
    company: 'Banyan Ventures',
    location: 'Whitefield',
    skills: ['Seed investing', 'Consumer', 'SaaS'],
    openToWork: false,
    links: {},
    character: 'investor',
    spot: { x: 15.15, z: -6.95, face: -0.97 },
  },
  {
    id: 'arjun',
    name: 'ARJUN MENON',
    role: 'Design Engineer',
    company: 'Loop Labs',
    location: 'HSR Layout',
    building: 'Tokenizer — Figma tokens to code',
    skills: ['React', 'Design tokens', 'Figma plugins'],
    openToWork: true,
    links: {},
    character: 'developer',
    path: [
      [22.6, -6.3],
      [28.4, -6.3],
    ],
    pause: 2.5,
  },
  {
    id: 'karthik',
    name: 'KARTHIK SHETTY',
    role: 'Motion Designer',
    company: 'Freelance',
    location: 'Jayanagar',
    building: 'Kinetic type experiments',
    skills: ['Motion', 'After Effects', 'Type'],
    openToWork: true,
    links: {},
    character: 'rockstar',
    path: [
      [13, 13],
      [27, 13],
      [27, 27],
      [13, 27],
    ],
    pause: 0.8,
  },
  {
    id: 'meera',
    name: 'MEERA IYER',
    role: 'Brand Designer',
    company: 'Peepal Labs',
    location: 'Koramangala',
    building: 'Peepal Labs rebrand',
    previously: 'Studio Kaapi',
    skills: ['Branding', 'Illustration', 'Identity'],
    openToWork: false,
    links: {},
    character: 'creative',
    spot: { x: -16.2, z: 7.15, face: PI },
  },
  {
    id: 'rohan',
    name: 'ROHAN GOWDA',
    role: 'Indie Hacker',
    company: 'Solo',
    location: 'BTM Layout',
    building: 'BusBuddy — live bus ETAs',
    skills: ['Mobile', 'Maps', 'Shipping fast'],
    openToWork: false,
    links: {},
    character: 'maker',
    spot: { x: 21.0, z: 6.4, face: PI + 0.4 },
  },
  {
    id: 'vikram',
    name: 'VIKRAM REDDY',
    role: 'Head of Product',
    company: 'Juno Pay',
    location: 'Bellandur',
    previously: 'Two startups, one exit',
    skills: ['Product strategy', 'Payments', 'Growth'],
    openToWork: false,
    links: {},
    character: 'pm',
    path: [
      [-6.4, -11],
      [-6.4, -30],
    ],
    pause: 3,
  },
  {
    id: 'aishwarya',
    name: 'AISHWARYA DAS',
    role: 'Design Systems Lead',
    company: 'Sutra',
    location: 'Malleshwaram',
    building: 'Open-source icon set',
    skills: ['Design systems', 'Icons', 'Accessibility'],
    openToWork: true,
    links: {},
    character: 'hero',
    path: [
      [6.2, 8.0],
      [-6.2, 8.0],
      [-7.9, 6.2],
      [-7.9, -6.0],
      [-6.0, -8.1],
      [6.2, -8.1],
      [7.9, -6.2],
      [7.9, 6.2],
    ],
    pause: 1.4,
  },
  {
    id: 'farah',
    name: 'FARAH KHAN',
    role: 'Interaction Designer',
    company: 'Orbit Forge',
    location: 'Hebbal',
    building: 'Mission-control UI',
    skills: ['Interaction', 'Data viz', 'Spacetech'],
    openToWork: false,
    links: {},
    character: 'moonshot',
    spot: { x: 6.6, z: 16.6, face: 0 },
  },
  {
    id: 'sam',
    name: "SAM D'SOUZA",
    role: 'Creative Technologist',
    company: 'Byte Mela',
    location: 'Frazer Town',
    building: 'Robots that sketch',
    skills: ['Creative coding', 'Robotics', '3D'],
    openToWork: true,
    links: {},
    character: 'bot',
    spot: { x: 17.5, z: 23, face: -0.6 },
  },
]
