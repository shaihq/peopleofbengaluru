import { create } from 'zustand'
import { supabase, type ProfileRow } from '@/lib/supabase'
import { PEOPLE as SAMPLES, type Profile } from './profiles'
import type { Status } from '../status'
import { getDistrict } from '../districts/active'
import { homeDistrict } from '../districts/registry'

// Who lives in the district: real approved profiles from Supabase + the
// sample cast (retired automatically once the real community is big enough).

const RETIRE_SAMPLES_AT = 8

type Directory = {
  real: Profile[]
  /** The signed-in player's own row (any status). */
  me: ProfileRow | null
  userId: string | null
  email: string | null
  /** 'setup' = the profiles table doesn't exist yet. */
  error: 'setup' | 'network' | null
  loaded: boolean
}

export const useDirectory = create<Directory>(() => ({ real: [], me: null, userId: null, email: null, error: null, loaded: false }))

export function rowToProfile(r: ProfileRow, slot: [number, number, number]): Profile {
  return {
    id: r.id,
    name: r.name.toUpperCase(),
    role: r.role,
    company: r.company ?? '',
    location: r.location,
    building: r.building ?? undefined,
    previously: r.previously ?? undefined,
    openToWork: r.open_to_work,
    skills: r.skills ?? [],
    links: { portfolio: r.portfolio ?? undefined, linkedin: r.linkedin ?? undefined, x: r.x ?? undefined },
    character: r.character,
    spot: { x: slot[0], z: slot[1], face: slot[2] },
    status: rowStatus(r),
  }
}

/** A profile row's status (note_* columns), or nothing. Expiry is checked where it's shown. */
export function rowStatus(r: ProfileRow): Status | undefined {
  if (!r.note_text && !r.note_emoji) return undefined
  return { text: r.note_text ?? '', emoji: r.note_emoji ?? '', expiresAt: r.note_expires_at ? Date.parse(r.note_expires_at) : null }
}

/** Deterministic placement: everyone at a spot gets the next free slot, oldest first; overflow fans out around it. */
function place(rows: ProfileRow[]) {
  const bySpot = new Map<string, ProfileRow[]>()
  for (const r of [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    // spots belong to the district the person appears in; unknown → that district's first spot
    const spots = getDistrict(homeDistrict(r.location)).spots
    const id = r.spot in spots ? r.spot : Object.keys(spots)[0]
    const key = `${homeDistrict(r.location)}|${id}`
    bySpot.set(key, [...(bySpot.get(key) ?? []), r])
  }
  const out = new Map<string, [number, number, number]>()
  for (const [key, list] of bySpot) {
    const [district, id] = key.split('|')
    const slots = getDistrict(district as Parameters<typeof getDistrict>[0]).spots[id].slots
    list.forEach((r, i) => {
      if (i < slots.length) return out.set(r.id, slots[i])
      const [x, z, f] = slots[i % slots.length]
      const a = (i - slots.length) * 2.4
      out.set(r.id, [x + Math.cos(a) * 1.3, z + Math.sin(a) * 1.3, f])
    })
  }
  return out
}

let samplesVisible = true

/** Everyone you can meet in the district (never includes you). */
export function getPeople(): Profile[] {
  const { real } = useDirectory.getState()
  samplesVisible = real.length < RETIRE_SAMPLES_AT
  return samplesVisible ? [...SAMPLES.map((p) => ({ ...p, sample: true })), ...real] : real
}

export function usePeople(): Profile[] {
  useDirectory((s) => s.real)
  return getPeople()
}

export const hasSamples = () => samplesVisible

export async function refreshDirectory() {
  if (!supabase) return useDirectory.setState({ loaded: true, error: 'setup' })
  const { data: auth } = await supabase.auth.getSession()
  const user = auth.session?.user ?? null
  const { data, error } = await supabase.from('profiles').select('*')
  if (error) {
    const setup = error.code === 'PGRST205' || error.code === '42P01'
    if (setup) console.info('[directory] profiles table not found — run supabase/migrations/0001_profiles.sql')
    return useDirectory.setState({ loaded: true, error: setup ? 'setup' : 'network', userId: user?.id ?? null, email: user?.email ?? null })
  }
  const rows = (data ?? []) as ProfileRow[]
  const approved = rows.filter((r) => r.status === 'approved')
  const me = user ? (rows.find((r) => r.id === user.id) ?? null) : null
  const slots = place(me && !approved.some((r) => r.id === me.id) ? [...approved, me] : approved)
  useDirectory.setState({
    real: approved.filter((r) => r.id !== user?.id).map((r) => rowToProfile(r, slots.get(r.id)!)),
    me,
    userId: user?.id ?? null,
    email: user?.email ?? null,
    error: null,
    loaded: true,
  })
}


if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  ;(window as unknown as { __dir?: typeof useDirectory }).__dir = useDirectory
}
