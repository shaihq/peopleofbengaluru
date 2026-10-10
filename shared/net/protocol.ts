// LIVE CITY wire format (CLAUDE.md Phase 8A). Binary, little-endian; byte 0 is the message type.
// Positions are centimetres in an i16 (±327 m, the district is ±46 m), facing is a u8 turn (256 steps).

export const Op = {
  // game → room
  Hello: 0x01,
  Pos: 0x02,
  // room → game
  Welcome: 0x10,
  Join: 0x11,
  Leave: 0x12,
  Snap: 0x13,
  Count: 0x14,
  Correct: 0x15,
} as const

export type Anim = 0 | 1 | 2 // idle · walk · run
export const ANIMS = ['idle', 'walk', 'run'] as const
/** flags bit 2 on a snapshot entry: they just left your radius (hold their last pose). */
export const FLAG_GONE = 0b100

export type Pose = { x: number; z: number; yaw: number; anim: Anim }
export type Entry = Pose & { slot: number; gone: boolean }

export type ServerMsg =
  | { op: typeof Op.Welcome; slot: number; member: boolean; tick: number }
  | { op: typeof Op.Join; people: { slot: number; uid: string }[] }
  | { op: typeof Op.Leave; slots: number[] }
  | { op: typeof Op.Snap; tick: number; entries: Entry[] }
  | { op: typeof Op.Count; members: number }
  | { op: typeof Op.Correct; x: number; z: number }

export type ClientMsg = { op: typeof Op.Hello; token: string } | ({ op: typeof Op.Pos } & Pose)

// ---- quantization ----

const TAU = Math.PI * 2
export const qPos = (m: number) => Math.max(-32768, Math.min(32767, Math.round(m * 100)))
export const dqPos = (q: number) => q / 100
export const qYaw = (rad: number) => ((Math.round((rad / TAU) * 256) % 256) + 256) % 256
export const dqYaw = (q: number) => (q / 256) * TAU
const flagsOf = (anim: Anim, gone = false) => (anim & 0b11) | (gone ? FLAG_GONE : 0)
const animOf = (flags: number) => Math.min(2, flags & 0b11) as Anim

// ---- uuid <-> 16 bytes ----

function writeUuid(v: DataView, at: number, uid: string) {
  const hex = uid.replace(/-/g, '')
  for (let i = 0; i < 16; i++) v.setUint8(at + i, parseInt(hex.slice(i * 2, i * 2 + 2), 16) || 0)
}
function readUuid(v: DataView, at: number) {
  let h = ''
  for (let i = 0; i < 16; i++) h += v.getUint8(at + i).toString(16).padStart(2, '0')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

// ---- game → room ----

const enc = new TextEncoder()
const dec = new TextDecoder()

export function encodeHello(token: string): ArrayBuffer {
  const t = enc.encode(token)
  const out = new Uint8Array(1 + t.length)
  out[0] = Op.Hello
  out.set(t, 1)
  return out.buffer
}

export function encodePos(p: Pose): ArrayBuffer {
  const v = new DataView(new ArrayBuffer(7))
  v.setUint8(0, Op.Pos)
  v.setInt16(1, qPos(p.x), true)
  v.setInt16(3, qPos(p.z), true)
  v.setUint8(5, qYaw(p.yaw))
  v.setUint8(6, flagsOf(p.anim))
  return v.buffer
}

/** null = malformed. */
export function decodeClient(buf: ArrayBuffer): ClientMsg | null {
  if (buf.byteLength < 1) return null
  const v = new DataView(buf)
  switch (v.getUint8(0)) {
    case Op.Hello:
      return { op: Op.Hello, token: dec.decode(new Uint8Array(buf, 1)) }
    case Op.Pos:
      if (buf.byteLength !== 7) return null
      return {
        op: Op.Pos,
        x: dqPos(v.getInt16(1, true)),
        z: dqPos(v.getInt16(3, true)),
        yaw: dqYaw(v.getUint8(5)),
        anim: animOf(v.getUint8(6)),
      }
    default:
      return null
  }
}

// ---- room → game ----

export function encodeWelcome(slot: number, member: boolean, tick: number): ArrayBuffer {
  const v = new DataView(new ArrayBuffer(6))
  v.setUint8(0, Op.Welcome)
  v.setUint16(1, slot, true)
  v.setUint8(3, member ? 1 : 0)
  v.setUint16(4, tick & 0xffff, true)
  return v.buffer
}

export function encodeJoin(people: { slot: number; uid: string }[]): ArrayBuffer {
  const v = new DataView(new ArrayBuffer(3 + people.length * 18))
  v.setUint8(0, Op.Join)
  v.setUint16(1, people.length, true)
  people.forEach((p, i) => {
    v.setUint16(3 + i * 18, p.slot, true)
    writeUuid(v, 5 + i * 18, p.uid)
  })
  return v.buffer
}

export function encodeLeave(slots: number[]): ArrayBuffer {
  const v = new DataView(new ArrayBuffer(3 + slots.length * 2))
  v.setUint8(0, Op.Leave)
  v.setUint16(1, slots.length, true)
  slots.forEach((s, i) => v.setUint16(3 + i * 2, s, true))
  return v.buffer
}

/** Entries are already quantized (the room keeps poses quantized): x/z in cm, yaw 0–255. */
export type QEntry = { slot: number; qx: number; qz: number; qyaw: number; anim: Anim; gone: boolean }

export function encodeSnap(tick: number, entries: QEntry[]): ArrayBuffer {
  const v = new DataView(new ArrayBuffer(5 + entries.length * 8))
  v.setUint8(0, Op.Snap)
  v.setUint16(1, tick & 0xffff, true)
  v.setUint16(3, entries.length, true)
  entries.forEach((e, i) => {
    const o = 5 + i * 8
    v.setUint16(o, e.slot, true)
    v.setInt16(o + 2, e.qx, true)
    v.setInt16(o + 4, e.qz, true)
    v.setUint8(o + 6, e.qyaw)
    v.setUint8(o + 7, flagsOf(e.anim, e.gone))
  })
  return v.buffer
}

export function encodeCount(members: number): ArrayBuffer {
  const v = new DataView(new ArrayBuffer(3))
  v.setUint8(0, Op.Count)
  v.setUint16(1, members, true)
  return v.buffer
}

export function encodeCorrect(x: number, z: number): ArrayBuffer {
  const v = new DataView(new ArrayBuffer(5))
  v.setUint8(0, Op.Correct)
  v.setInt16(1, qPos(x), true)
  v.setInt16(3, qPos(z), true)
  return v.buffer
}

/** null = malformed or unknown. */
export function decodeServer(buf: ArrayBuffer): ServerMsg | null {
  if (buf.byteLength < 1) return null
  const v = new DataView(buf)
  const len = buf.byteLength
  switch (v.getUint8(0)) {
    case Op.Welcome:
      if (len !== 6) return null
      return { op: Op.Welcome, slot: v.getUint16(1, true), member: v.getUint8(3) === 1, tick: v.getUint16(4, true) }
    case Op.Join: {
      if (len < 3) return null
      const n = v.getUint16(1, true)
      if (len !== 3 + n * 18) return null
      const people = []
      for (let i = 0; i < n; i++) people.push({ slot: v.getUint16(3 + i * 18, true), uid: readUuid(v, 5 + i * 18) })
      return { op: Op.Join, people }
    }
    case Op.Leave: {
      if (len < 3) return null
      const n = v.getUint16(1, true)
      if (len !== 3 + n * 2) return null
      const slots = []
      for (let i = 0; i < n; i++) slots.push(v.getUint16(3 + i * 2, true))
      return { op: Op.Leave, slots }
    }
    case Op.Snap: {
      if (len < 5) return null
      const n = v.getUint16(3, true)
      if (len !== 5 + n * 8) return null
      const entries: Entry[] = []
      for (let i = 0; i < n; i++) {
        const o = 5 + i * 8
        const flags = v.getUint8(o + 7)
        entries.push({
          slot: v.getUint16(o, true),
          x: dqPos(v.getInt16(o + 2, true)),
          z: dqPos(v.getInt16(o + 4, true)),
          yaw: dqYaw(v.getUint8(o + 6)),
          anim: animOf(flags),
          gone: (flags & FLAG_GONE) !== 0,
        })
      }
      return { op: Op.Snap, tick: v.getUint16(1, true), entries }
    }
    case Op.Count:
      if (len !== 3) return null
      return { op: Op.Count, members: v.getUint16(1, true) }
    case Op.Correct:
      if (len !== 5) return null
      return { op: Op.Correct, x: dqPos(v.getInt16(1, true)), z: dqPos(v.getInt16(3, true)) }
    default:
      return null
  }
}
