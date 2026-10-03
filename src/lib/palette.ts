// World + UI color tokens. Source of truth: design.md §3 and §10.2.
// Never introduce a color in the world that isn't here.

export const C = {
  SKY_TOP: '#5FA8E0',
  SKY_TOP_LIGHT: '#A9CFF0',
  SKY_HORIZON: '#F4DDB4',
  SUN: '#FFD9A0',
  SHADOW_TINT: '#5A6E9A',
  GROUND_BOUNCE: '#C9A27A',

  CONCRETE_WARM: '#D8C7AE',
  CONCRETE_AGED: '#B8A68C',
  TERRACOTTA: '#C8643C',
  ROOF_TILE: '#B5523A',

  WALL_MINT: '#9CCFB4',
  WALL_BUTTER: '#F2D58A',
  WALL_POWDER: '#9EC3D9',
  WALL_SALMON: '#E8A08A',
  WALL_PINK: '#E59AA6',
  WALL_WHITE: '#F3EDE1',

  LEAF_DEEP: '#2F5E34',
  LEAF_MID: '#4E8A3E',
  LEAF_LIGHT: '#8DBB4F',

  ASPHALT: '#4A4A52',
  ROAD_PAINT: '#E9E2CF',
  KERB_YELLOW: '#F2C230',
  KERB_BLACK: '#2B2B2B',

  AUTO_GREEN: '#2E8B4E',
  AUTO_YELLOW: '#F2C230',
  BMTC_BLUE: '#2E6FB7',

  // Supporting tones, derived from the palette above
  GLASS: '#45678A',
  GRILLE: '#3A3D46',
  STEEL: '#C3C9CF',
  TRUNK: '#6E5D4E',
  GRASS: '#86AE52',
  PAVER: '#D3C6AE',
  PATH: '#C98B6B',
  TANK: '#2E3036',
  WOOD: '#8A5A3C',
  RAIL_GREEN: '#3E7A4A',
  KOTA: '#D9D2C3',
  FLAME: '#E8552E',
  BOUGAIN: '#E0559A',
  SIGN_RED: '#A8321F',
  INTERIOR: '#5B4A40',
} as const

export const UI = {
  INK: '#1C1F2B',
  INK_SOFT: '#2A2F40',
  CREAM: '#FFF6E5',
  SAFFRON: '#FFB020',
  ACTION: '#FF5A36',
  OPEN: '#3DDC84',
} as const
