import { DurableObject } from 'cloudflare:workers'
import {
  CLOSE,
  FLOOD_S,
  HELLO_TIMEOUT_MS,
  IDLE_STOP_MS,
  INTEREST_DROP_R,
  INTEREST_R,
  MAX_HELLO_BYTES,
  MAX_MSGS_PER_S,
  MAX_MSG_BYTES,
  ROOM_HARD_CAP,
  TICK_MS,
} from '../../shared/net/config'
import {
  Op,
  decodeClient,
  encodeCorrect,
  encodeCount,
  encodeJoin,
  encodeLeave,
  encodeSnap,
  encodeWelcome,
  qPos,
  qYaw,
  type Anim,
  type QEntry,
} from '../../shared/net/protocol'
import { checkMove, firstMove, type MoveState } from '../../shared/net/validate'
import { member } from './auth'
import { cityOf, type Env } from './env'

// One district shard of the LIVE CITY (CLAUDE.md Phase 8A). Approved members only. Holds who is here and
// where, in memory only.
// Sockets use the Hibernation API: an idle room sleeps (no cost) with everyone still connected. The tick runs
// only while someone is moving, and each player gets one message per tick with the people near them.

/** Per-socket state. Kept on the socket (serializeAttachment) when it matters across a sleep. */
type Seat = {
  room: string
  slot: number
  uid: string | null
  member: boolean
  hello: boolean
  /** login token expiry (unix s): the socket is closed then, and the game rejoins with a fresh token */
  exp: number
  joinedAt: number
  /** last accepted position (for the movement check) */
  move: MoveState | null
  qx: number
  qz: number
  qyaw: number
  anim: Anim
}

/** Sockets per room, including ones that haven't said hello yet. */
const MAX_SOCKETS = ROOM_HARD_CAP + 40
const HEARTBEAT_MS = 60_000
const REPORT_DEBOUNCE_MS = 2000
/** alarms can fire a few ms early */
const ALARM_SLACK_MS = 250
const R_IN = (INTEREST_R * 100) ** 2
const R_OUT = (INTEREST_DROP_R * 100) ** 2

const poseKey = (s: Seat) => ((s.qx + 32768) * 65536 + (s.qz + 32768)) * 1024 + s.qyaw * 4 + s.anim

function send(ws: WebSocket, data: ArrayBuffer) {
  try {
    ws.send(data)
  } catch {
    // closing; webSocketClose cleans up
  }
}

export class Room extends DurableObject<Env> {
  private name = ''
  private seats = new Map<WebSocket, Seat>()
  /** what each recipient was last sent about each slot */
  private seen = new Map<WebSocket, Map<number, number>>()
  private flood = new Map<WebSocket, { sec: number; n: number; strikes: number }>()
  private timer: ReturnType<typeof setInterval> | null = null
  private lastMove = 0
  private tickN = 0
  private reportTimer: ReturnType<typeof setTimeout> | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // waking from sleep: everyone is still connected; rebuild from what each socket carries
    for (const ws of ctx.getWebSockets()) {
      const s = ws.deserializeAttachment() as Seat | null
      if (!s) continue
      this.seats.set(ws, s)
      this.name ||= s.room
    }
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))
  }

  async fetch(req: Request): Promise<Response> {
    this.name ||= req.headers.get('x-room') ?? ''
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 })
    if (this.seats.size >= MAX_SOCKETS) return new Response('room full', { status: 503 })

    const pair = new WebSocketPair()
    const [client, server] = [pair[0], pair[1]]
    this.ctx.acceptWebSocket(server)
    const seat: Seat = {
      room: this.name,
      slot: -1,
      uid: null,
      member: false,
      hello: false,
      exp: 0,
      joinedAt: Date.now(),
      move: null,
      qx: 0,
      qz: 0,
      qyaw: 0,
      anim: 0,
    }
    server.serializeAttachment(seat)
    this.seats.set(server, seat)
    await this.alarmBy(Date.now() + HELLO_TIMEOUT_MS)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer) {
    if (typeof msg === 'string') return // keepalive "ping" is answered without waking us
    const seat = this.seat(ws)
    if (!seat || this.flooding(ws)) return
    if (msg.byteLength > (seat.hello ? MAX_MSG_BYTES : MAX_HELLO_BYTES)) return
    const m = decodeClient(msg)
    if (!m) return
    if (m.op === Op.Hello) return this.hello(ws, seat, m.token)
    if (!seat.hello) return

    const now = Date.now()
    const next = seat.move ? checkMove(seat.move, m.x, m.z, now) : firstMove(m.x, m.z, now)
    if (!next) {
      if (seat.move) send(ws, encodeCorrect(seat.move.x, seat.move.z))
      return
    }
    seat.move = next
    seat.qx = qPos(m.x)
    seat.qz = qPos(m.z)
    seat.qyaw = qYaw(m.yaw)
    seat.anim = m.anim
    // resting poses survive a sleep; moving ones keep the room awake anyway
    if (m.anim === 0) ws.serializeAttachment(seat)
    this.wake()
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    this.drop(ws)
    try {
      ws.close(code, reason)
    } catch {
      // already closed
    }
  }

  async webSocketError(ws: WebSocket) {
    this.drop(ws)
  }

  /** Hello timeouts, expired logins, and the heartbeat to City while anyone is here. */
  async alarm() {
    const now = Date.now()
    let pending = Infinity
    for (const [ws, s] of this.seats) {
      const due = s.hello ? s.exp * 1000 : s.joinedAt + HELLO_TIMEOUT_MS
      if (due <= now + ALARM_SLACK_MS) this.kick(ws, s.hello ? CLOSE.EXPIRED : CLOSE.HELLO_TIMEOUT, s.hello ? 'login expired' : 'hello timeout')
      else pending = Math.min(pending, due)
    }
    if (this.memberCount() > 0) await this.report()
    // this alarm is spent: set the next one outright (alarmBy would compare against the one firing now)
    if (this.seats.size > 0) await this.ctx.storage.setAlarm(Math.min(pending, now + HEARTBEAT_MS))
  }

  // ---------------------------------------------------------------------------

  private seat(ws: WebSocket) {
    let s = this.seats.get(ws)
    if (!s) {
      s = (ws.deserializeAttachment() as Seat | null) ?? undefined
      if (s) this.seats.set(ws, s)
    }
    return s
  }

  private memberCount() {
    let n = 0
    for (const s of this.seats.values()) if (s.hello && s.member) n++
    return n
  }

  private async hello(ws: WebSocket, seat: Seat, token: string) {
    if (seat.hello) return
    const who = await member(this.env, token)
    if (!this.seats.has(ws)) return // left while we checked
    if (!who) return this.kick(ws, CLOSE.NOT_MEMBER, 'members only')

    // one socket per person: the newest wins (a second tab or device, a reconnect racing the old socket)
    let tookOver = false
    for (const [other, s] of this.seats) {
      if (other === ws || s.uid !== who.uid) continue
      if (s.hello) tookOver = true // it was live, not just a socket still connecting
      this.kick(other, CLOSE.REPLACED, 'replaced')
    }
    if (this.memberCount() >= ROOM_HARD_CAP) return this.kick(ws, CLOSE.FULL, 'room full')

    const used = new Set([...this.seats.values()].map((s) => s.slot))
    let slot = 0
    while (used.has(slot)) slot++
    Object.assign(seat, { slot, uid: who.uid, member: true, hello: true, exp: who.exp })
    ws.serializeAttachment(seat)

    send(ws, encodeWelcome(slot, true, this.tickN, tookOver))
    const here = [...this.seats.entries()].filter(([o, s]) => o !== ws && s.hello && s.member && s.uid)
    if (here.length) send(ws, encodeJoin(here.map(([, s]) => ({ slot: s.slot, uid: s.uid! }))))
    const join = encodeJoin([{ slot, uid: who.uid }])
    for (const [o, s] of this.seats) if (o !== ws && s.hello) send(o, join)
    this.broadcastCount()
    this.scheduleReport()
    await this.alarmBy(who.exp * 1000)
    this.wake() // so the newcomer gets everyone's position now
  }

  /** Remove a socket and tell the room. */
  private drop(ws: WebSocket) {
    const s = this.seats.get(ws) ?? (ws.deserializeAttachment() as Seat | null)
    this.seats.delete(ws)
    this.seen.delete(ws)
    this.flood.delete(ws)
    if (!s?.hello || !s.member) return
    for (const m of this.seen.values()) m.delete(s.slot)
    const leave = encodeLeave([s.slot])
    for (const [o, x] of this.seats) if (x.hello) send(o, leave)
    this.broadcastCount()
    this.scheduleReport()
  }

  private kick(ws: WebSocket, code: number, reason: string) {
    this.drop(ws)
    try {
      ws.close(code, reason)
    } catch {
      // already gone
    }
  }

  /** True = ignore this message. Too many in a second for FLOOD_S seconds in a row closes the socket. */
  private flooding(ws: WebSocket) {
    const sec = Math.floor(Date.now() / 1000)
    let f = this.flood.get(ws)
    if (!f) this.flood.set(ws, (f = { sec, n: 0, strikes: 0 }))
    if (f.sec !== sec) {
      f.strikes = f.n > MAX_MSGS_PER_S ? f.strikes + 1 : 0
      f.sec = sec
      f.n = 0
    }
    f.n++
    if (f.strikes >= FLOOD_S) {
      this.kick(ws, CLOSE.FLOOD, 'too many messages')
      return true
    }
    return f.n > MAX_MSGS_PER_S
  }

  private broadcastCount() {
    const c = encodeCount(this.memberCount())
    for (const [o, s] of this.seats) if (s.hello) send(o, c)
  }

  private wake() {
    this.lastMove = Date.now()
    if (!this.timer) this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  /** One message per player: the members near them whose pose changed since they last heard. */
  private tick() {
    this.tickN = (this.tickN + 1) & 0xffff
    const movers = [...this.seats.values()].filter((s) => s.hello && s.member && s.move)
    for (const [ws, me] of this.seats) {
      if (!me.hello || !me.move) continue
      let seen = this.seen.get(ws)
      if (!seen) this.seen.set(ws, (seen = new Map()))
      const out: QEntry[] = []
      for (const o of movers) {
        if (o === me) continue
        const dx = o.qx - me.qx
        const dz = o.qz - me.qz
        const d2 = dx * dx + dz * dz
        const had = seen.has(o.slot)
        if (d2 <= R_IN || (had && d2 <= R_OUT)) {
          const k = poseKey(o)
          if (seen.get(o.slot) !== k) {
            seen.set(o.slot, k)
            out.push({ slot: o.slot, qx: o.qx, qz: o.qz, qyaw: o.qyaw, anim: o.anim, gone: false })
          }
        } else if (had) {
          seen.delete(o.slot)
          out.push({ slot: o.slot, qx: o.qx, qz: o.qz, qyaw: o.qyaw, anim: 0, gone: true })
        }
      }
      if (out.length) send(ws, encodeSnap(this.tickN, out))
    }
    if (Date.now() - this.lastMove > IDLE_STOP_MS && this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private scheduleReport() {
    if (this.reportTimer) return
    this.reportTimer = setTimeout(() => {
      this.reportTimer = null
      void this.report()
    }, REPORT_DEBOUNCE_MS)
  }

  private async report() {
    if (!this.name) return
    const uids = [...this.seats.values()].filter((s) => s.hello && s.member && s.uid).map((s) => s.uid!)
    try {
      await cityOf(this.env).report(this.name, uids)
    } catch (e) {
      console.error('[room] report', e)
    }
    if (uids.length) await this.alarmBy(Date.now() + HEARTBEAT_MS)
  }

  private async alarmBy(at: number) {
    const cur = await this.ctx.storage.getAlarm()
    if (cur === null || cur > at) await this.ctx.storage.setAlarm(at)
  }
}
