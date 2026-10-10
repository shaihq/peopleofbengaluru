// LIVE CITY (CLAUDE.md Phase 8A) — numbers shared by the game (src/game/net) and the room server (realtime/).
// Plain TypeScript only: no `@/` imports, no DOM, no Node — both builds compile this folder.

/** Districts that have rooms (the built ones, src/game/districts/registry.ts). */
export const ROOM_DISTRICTS = ['koramangala', 'hsr'] as const
export type RoomDistrict = (typeof ROOM_DISTRICTS)[number]

/** Server ticks per second while anyone is moving. */
export const TICK_HZ = 10
export const TICK_MS = 1000 / TICK_HZ
/** The game sends its position at most this often, and only when it changed. */
export const SEND_HZ = 10

/** You receive the people within this radius (m); they drop out a little further on, so the edge doesn't flicker. */
export const INTEREST_R = 40
export const INTEREST_DROP_R = 44

/** A room fills to ROOM_CAP members before the next shard opens; HARD is the refusal line. */
export const ROOM_CAP = 150
export const ROOM_HARD_CAP = 160

/** Every district is the same square (src/game/layout.ts). */
export const BOUNDS = 46

/** Player speeds, m/s (src/game/player/Player.tsx). */
export const WALK = 3.0
export const RUN = 6.8
/** Movement check: how far over RUN a client may drift (lag, frame spikes). */
export const SPEED_TOL = 1.5
/** Slack on top of the speed budget, m. */
export const MOVE_SLACK = 0.3
/** Most distance a burst may cover at once: half a second at full tolerated speed. */
export const BURST_S = 0.5

/** Remote people are drawn this far in the past, so there are always two snapshots to blend between. */
export const INTERP_MS = 120
/** Longest the game guesses ahead when a snapshot is late. */
export const EXTRAP_MS = 250
/** No data for this long: the person stands still. */
export const STALE_MS = 3000

/** Size caps. A HELLO carries the login token, so it may be bigger. */
export const MAX_MSG_BYTES = 64
export const MAX_HELLO_BYTES = 4096
/** More than this many messages a second, for FLOOD_S seconds, closes the socket. */
export const MAX_MSGS_PER_S = 30
export const FLOOD_S = 3
/** The first message must be HELLO, within this long. */
export const HELLO_TIMEOUT_MS = 5000
/** The room stops ticking when nobody has moved for this long (so it can sleep). */
export const IDLE_STOP_MS = 2000

/** Close codes. */
export const CLOSE = {
  FULL: 4001,
  REPLACED: 4002,
  FLOOD: 4003,
  HELLO_TIMEOUT: 4004,
  BAD: 4005,
  /** not signed in, or not an approved member: the live city is members only */
  NOT_MEMBER: 4006,
  /** the login token ran out: rejoin with a fresh one */
  EXPIRED: 4007,
} as const

/** "koramangala#2" — district plus shard number (1-based). */
export const roomName = (d: RoomDistrict, shard: number) => `${d}#${shard}`
export function parseRoom(name: string): { district: RoomDistrict; shard: number } | null {
  const m = /^([a-z]+)#([1-9]\d{0,2})$/.exec(name)
  if (!m || !(ROOM_DISTRICTS as readonly string[]).includes(m[1])) return null
  return { district: m[1] as RoomDistrict, shard: Number(m[2]) }
}
