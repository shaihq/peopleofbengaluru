import { C } from '@/lib/palette'

// Playable character styles (CLAUDE.md Phase 2). One shared universe: same
// proportions push, same palette discipline, Bengaluru skin tones.
//
// Interim assets: CC0 "Ultimate Modular Men/Women" by Quaternius (poly.pizza)
// and CC0 "RobotExpressive" — restyled here. See public/models/CREDITS.md.

export type Rig = 'modular' | 'robot'

export type CharacterDef = {
  id: string
  name: string
  tagline: string
  file: string
  rig: Rig
  /** Signature colour — used for UI swatches. */
  accent: string
  /** Material name → colour. Unlisted materials keep a neutral restyle. */
  colors: Record<string, string>
  hide?: string[]
  /** Materials to hide entirely. */
  invisible?: string[]
  /** Materials rendered as clear glass with a bright rim (the guest look). */
  glass?: string[]
  /** Not offered on the character-select screen. */
  hidden?: boolean
}

const SKIN = { a: '#8D5A3B', b: '#A86F4C', c: '#7A4A30', d: '#B57E5A', e: '#C68E68' }
const HAIR = '#1F1A18'
const INK = '#2B2F45'
const CREAM = '#F3EDE1'

export const CLIPS: Record<Rig, { idle: string; walk: string; run: string; wave: string }> = {
  modular: { idle: 'CharacterArmature|Idle', walk: 'CharacterArmature|Walk', run: 'CharacterArmature|Run', wave: 'CharacterArmature|Wave' },
  robot: { idle: 'Idle', walk: 'Walking', run: 'Running', wave: 'Wave' },
}

export const ROSTER: CharacterDef[] = [
  {
    id: 'designer',
    name: 'THE DESIGNER',
    tagline: 'Pixels with attitude.',
    file: '/models/characters/designer.glb',
    rig: 'modular',
    accent: C.FLAME,
    colors: { Skin: SKIN.b, Pink: C.FLAME, Black: INK, Grey: '#6B7083', Hair_Brown: HAIR, Brown: '#4A3A30' },
  },
  {
    id: 'developer',
    name: 'THE DEVELOPER',
    tagline: 'Ships at 2 AM.',
    file: '/models/characters/developer.glb',
    rig: 'modular',
    accent: '#1F8A70',
    colors: { Skin: SKIN.a, Purple: '#1F8A70', White: CREAM, LightBlue: INK, Hair: HAIR, Eyebrows: HAIR, Eye: '#1C1F2B' },
  },
  {
    id: 'founder',
    name: 'THE FOUNDER',
    tagline: 'Pitch deck always loaded.',
    file: '/models/characters/founder.glb',
    rig: 'modular',
    accent: C.BMTC_BLUE,
    colors: { Skin: SKIN.d, Black: C.BMTC_BLUE, White: CREAM, Hair_Blond: HAIR, Hair_Brown: HAIR, Brown: '#2B2D33' },
  },
  {
    id: 'maker',
    name: 'THE MAKER',
    tagline: 'Builds in public.',
    file: '/models/characters/maker.glb',
    rig: 'modular',
    accent: '#D9A441',
    colors: {
      Skin: SKIN.c,
      Green: '#D9A441',
      LightGreen: C.WALL_BUTTER,
      Brown: '#5B4A40',
      Brown2: '#3B302A',
      Black: INK,
      Grey: '#7D8791',
      Gold: C.KERB_YELLOW,
      Hair: HAIR,
      Eyebrows: HAIR,
      Eye: '#1C1F2B',
    },
  },
  {
    id: 'creative',
    name: 'THE CREATIVE',
    tagline: 'Brand, motion, magic.',
    file: '/models/characters/creative.glb',
    rig: 'modular',
    accent: C.TERRACOTTA,
    colors: { Skin: SKIN.e, White: CREAM, Orange: C.TERRACOTTA, Grey: '#4A4D55', Hair_Blond: HAIR, Hair_Brown: HAIR, Brown: '#3B302A' },
  },
  {
    id: 'pm',
    name: 'THE PRODUCT LEAD',
    tagline: 'Roadmaps & filter coffee.',
    file: '/models/characters/pm.glb',
    rig: 'modular',
    accent: '#3E5C8A',
    colors: {
      Skin: SKIN.a,
      Skin_Darker: '#6E4430',
      White: CREAM,
      LightBlue: '#3E5C8A',
      Red_Dark: C.FLAME,
      LightBrown: C.WALL_BUTTER,
      Hair: HAIR,
      Eyebrows: HAIR,
      Eye: '#1C1F2B',
    },
  },
  {
    id: 'rockstar',
    name: 'THE MOTION ARTIST',
    tagline: 'Loud colours, louder ideas.',
    file: '/models/characters/rockstar.glb',
    rig: 'modular',
    accent: C.WALL_PINK,
    colors: {
      Skin: SKIN.b,
      Black: '#23262F',
      LightBlue: '#4A6FA8',
      White: CREAM,
      Red_Dark: C.WALL_PINK,
      Red: C.WALL_PINK,
      Earrings: C.KERB_YELLOW,
      Eyebrows: HAIR,
      Eye: '#1C1F2B',
    },
  },
  {
    id: 'investor',
    name: 'THE INVESTOR',
    tagline: 'Looking for the next unicorn.',
    file: '/models/characters/investor.glb',
    rig: 'modular',
    accent: '#3A3F55',
    colors: { Skin: SKIN.d, Suit: '#3A3F55', Black: '#23262F', White: CREAM, Tie: C.FLAME, Hair: HAIR, Eyebrows: HAIR, Eye: '#1C1F2B' },
  },
  {
    id: 'hero',
    name: 'THE HERO',
    tagline: 'Saves the sprint.',
    file: '/models/characters/hero.glb',
    rig: 'modular',
    accent: '#FFB020',
    colors: {
      Skin: SKIN.c,
      Blue: '#FFB020',
      LightBlue: '#FFD27A',
      Black: '#23262F',
      Grey: '#ECE6DA',
      Metal: '#C3C9CF',
      DarkBrown: '#3B302A',
      Brown: '#4A3A30',
      Hair_Black: HAIR,
    },
    hide: ['Pistol'],
  },
  {
    id: 'moonshot',
    name: 'THE MOONSHOT',
    tagline: 'Building for orbit.',
    file: '/models/characters/moonshot.glb',
    rig: 'modular',
    accent: C.WALL_POWDER,
    colors: { SciFi_Light: CREAM, SciFi_Light_Accent: '#FFB020', SciFi_Main: C.WALL_POWDER, SciFi_MainDark: INK, Grey: '#9AA0A8' },
  },
  {
    id: 'bot',
    name: 'THE BOT',
    tagline: 'Beep. Ship it.',
    file: '/models/robot.glb',
    rig: 'robot',
    accent: '#F25C2A',
    colors: { Main: '#F25C2A', Grey: '#ECE6DA', Black: '#262A35' },
  },
]

// Guests explore as the Invisible: a glass body in a hoodie, shorts and sneakers.
ROSTER.push({
  id: 'invisible',
  name: 'THE INVISIBLE',
  tagline: 'Nobody can see you yet.',
  file: '/models/characters/developer.glb',
  rig: 'modular',
  accent: '#9AA0A8',
  colors: { Purple: '#ECE6DA', White: '#ECE6DA', LightBlue: '#7D8791' },
  glass: ['Skin', 'Hair'],
  invisible: ['Eye', 'Eyebrows'],
  hidden: true,
})

export const PLAYABLE = ROSTER.filter((c) => !c.hidden)

export const DEFAULT_CHARACTER = 'designer'

export const getCharacter = (id: string) => ROSTER.find((c) => c.id === id) ?? ROSTER[0]
