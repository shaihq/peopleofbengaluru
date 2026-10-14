import { C } from '@/lib/palette'

// The districts of the city (CLAUDE.md Phase 6). Built one at a time —
// unbuilt districts show as "coming soon" at the portal.

export type DistrictId = 'koramangala' | 'hsr' | 'bellandur' | 'whitefield' | 'domlur'

export type DistrictInfo = {
  id: DistrictId
  /** Matches a profile's `location`. */
  name: string
  title: string
  kn: string
  identity: string
  accent: string
  built: boolean
}

export const DISTRICTS: DistrictInfo[] = [
  { id: 'koramangala', name: 'Koramangala', title: 'KORAMANGALA', kn: 'ಕೋರಮಂಗಲ', identity: 'Startup · Design · Founder district', accent: C.FLAME, built: true },
  { id: 'hsr', name: 'HSR Layout', title: 'HSR LAYOUT', kn: 'ಎಚ್‌ಎಸ್‌ಆರ್ ಲೇಔಟ್', identity: 'Builder · Indie district', accent: '#1F8A70', built: true },
  { id: 'bellandur', name: 'Bellandur', title: 'BELLANDUR', kn: 'ಬೆಳ್ಳಂದೂರು', identity: 'Tech corridor district', accent: C.BMTC_BLUE, built: false },
  { id: 'whitefield', name: 'Whitefield', title: 'WHITEFIELD', kn: 'ವೈಟ್‌ಫೀಲ್ಡ್', identity: 'Enterprise · Tech district', accent: '#3E5C8A', built: false },
  { id: 'domlur', name: 'Domlur', title: 'DOMLUR', kn: 'ದೊಮ್ಮಲೂರು', identity: 'Old meets new', accent: C.TERRACOTTA, built: false },
]

export const districtInfo = (id: DistrictId) => DISTRICTS.find((d) => d.id === id)!

/** Where a person lives in the game. Unknown / legacy locations count as Koramangala. */
export function districtOfLocation(location: string): DistrictInfo {
  return DISTRICTS.find((d) => d.name.toLowerCase() === location.toLowerCase()) ?? DISTRICTS[0]
}

/**
 * Where someone says they are. profiles.location is one text field (≤ 40): a district's name, another
 * area of Bengaluru as typed ("Jayanagar"), or another city with a leading "@" ("@Pune"). Anything that
 * isn't a built district visits Koramangala.
 */
export type PlaceKind = 'district' | 'blr' | 'city'
export const CITY_MARK = '@'

export function placeKind(location: string): PlaceKind {
  if (location.startsWith(CITY_MARK)) return 'city'
  return DISTRICTS.some((d) => d.name.toLowerCase() === location.toLowerCase()) ? 'district' : 'blr'
}

/** The place as typed, without the city mark. */
export const placeName = (location: string) => (location.startsWith(CITY_MARK) ? location.slice(1) : location)

/** For display: "Jayanagar, Bengaluru" · "Pune". */
export const placeLabel = (location: string) =>
  placeKind(location) === 'city' ? placeName(location) : `${placeName(location)}, Bengaluru`

/** The district a person actually appears in right now (visitors stay in Koramangala). */
export function homeDistrict(location: string): DistrictId {
  const d = districtOfLocation(location)
  return d.built ? d.id : 'koramangala'
}
