import { create } from 'zustand'

// LIVE CITY state for the HUD and the people (CLAUDE.md Phase 8A). Positions themselves live in remotes.ts
// (read every frame, never through React).

export type NetStatus = 'off' | 'connecting' | 'live' | 'down' | 'replaced'

type Net = {
  status: NetStatus
  /** the shard you're in, e.g. "koramangala#1" */
  room: string | null
  /** members in your shard right now */
  hereNow: number
  /** members online per district (from the City, up to 15 s old), null until first read */
  cityCounts: Record<string, number> | null
  /** members per shard (from the City) */
  cityRooms: Record<string, number>
  /** member id → the district they're live in right now */
  online: Record<string, string>
  /** member ids live in your room (driven by the network, not wandering) */
  live: Set<string>
  /** round trip to the room in ms (median of the last few), null until measured */
  ping: number | null
}

export const useNet = create<Net>(() => ({
  status: 'off',
  room: null,
  hereNow: 0,
  cityCounts: null,
  cityRooms: {},
  online: {},
  live: new Set(),
  ping: null,
}))

if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  ;(window as unknown as { __net?: typeof useNet }).__net = useNet
}
