import { DurableObject } from 'cloudflare:workers'
import { ROOM_CAP, ROOM_DISTRICTS, parseRoom, roomName, type RoomDistrict } from '../../shared/net/config'
import type { Env } from './env'

// The LIVE CITY switchboard (CLAUDE.md Phase 8A): which shard to join, and who is here now in each district.
// Rooms report their members (on change, and every minute while anyone is in); a report older than
// STALE_MS is treated as an empty room, so a room that died can't hold people "online" forever.

type RoomInfo = { uids: string[]; at: number }
export type CitySnapshot = {
  counts: Record<RoomDistrict, number>
  /** members per shard, so a client can add its own room's live count to the others */
  rooms: Record<string, number>
  online: Record<string, RoomDistrict>
}

const STALE_MS = 150_000
const RESERVE_MS = 10_000
const MAX_SHARDS = 50

export class City extends DurableObject<Env> {
  private rooms = new Map<string, RoomInfo>()
  /** joins handed out but not reported yet, so a rush doesn't overfill one shard */
  private reserved = new Map<string, number[]>()

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<Record<string, RoomInfo>>('rooms')
      if (saved) this.rooms = new Map(Object.entries(saved))
    })
  }

  async report(name: string, uids: string[]) {
    if (!parseRoom(name)) return
    if (uids.length) this.rooms.set(name, { uids: uids.slice(0, 500), at: Date.now() })
    else this.rooms.delete(name)
    this.reserved.delete(name)
    await this.ctx.storage.put('rooms', Object.fromEntries(this.rooms))
  }

  /** The shard to join: the one with the person you're heading to (if it has room), else the lowest with room. */
  async assign(district: string, withUid?: string): Promise<{ room: string } & CitySnapshot> {
    const d = (ROOM_DISTRICTS as readonly string[]).includes(district) ? (district as RoomDistrict) : ROOM_DISTRICTS[0]
    this.prune()
    const load = (name: string) => (this.rooms.get(name)?.uids.length ?? 0) + (this.reserved.get(name)?.length ?? 0)

    let room: string | null = null
    if (withUid) {
      for (const [name, r] of this.rooms) {
        if (parseRoom(name)?.district === d && r.uids.includes(withUid) && load(name) < ROOM_CAP) room = name
      }
    }
    for (let shard = 1; !room && shard <= MAX_SHARDS; shard++) {
      const name = roomName(d, shard)
      if (load(name) < ROOM_CAP) room = name
    }
    room ??= roomName(d, MAX_SHARDS)
    this.reserved.set(room, [...(this.reserved.get(room) ?? []), Date.now() + RESERVE_MS])
    return { room, ...this.snapshot() }
  }

  async read(): Promise<CitySnapshot> {
    this.prune()
    return this.snapshot()
  }

  private snapshot(): CitySnapshot {
    const counts = Object.fromEntries(ROOM_DISTRICTS.map((d) => [d, 0])) as Record<RoomDistrict, number>
    const online: Record<string, RoomDistrict> = {}
    const rooms: Record<string, number> = {}
    for (const [name, r] of this.rooms) {
      const p = parseRoom(name)
      if (!p) continue
      counts[p.district] += r.uids.length
      rooms[name] = r.uids.length
      for (const u of r.uids) online[u] = p.district
    }
    return { counts, rooms, online }
  }

  private prune() {
    const now = Date.now()
    for (const [name, r] of this.rooms) if (now - r.at > STALE_MS) this.rooms.delete(name)
    for (const [name, list] of this.reserved) {
      const live = list.filter((t) => t > now)
      if (live.length) this.reserved.set(name, live)
      else this.reserved.delete(name)
    }
  }
}
