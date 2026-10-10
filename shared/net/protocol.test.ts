import { describe, expect, it } from 'vitest'
import {
  Op,
  decodeClient,
  decodeServer,
  encodeCorrect,
  encodeCount,
  encodeHello,
  encodeJoin,
  encodeLeave,
  encodePos,
  encodeSnap,
  encodeWelcome,
  qPos,
  qYaw,
} from './protocol'
import { parseRoom, roomName } from './config'

const uid = '0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0'

describe('game → room', () => {
  it('round-trips a position (cm, 1/256 turn)', () => {
    const m = decodeClient(encodePos({ x: 12.345, z: -45.99, yaw: Math.PI / 2, anim: 2 }))
    expect(m).toMatchObject({ op: Op.Pos, x: 12.35, z: -45.99, anim: 2 })
    if (m?.op !== Op.Pos) throw new Error()
    expect(m.yaw).toBeCloseTo(Math.PI / 2, 1)
  })

  it('round-trips the login token', () => {
    expect(decodeClient(encodeHello('eyJ.abc.def'))).toEqual({ op: Op.Hello, token: 'eyJ.abc.def' })
  })

  it('rejects junk', () => {
    expect(decodeClient(new ArrayBuffer(0))).toBeNull()
    expect(decodeClient(new Uint8Array([Op.Pos, 1, 2]).buffer)).toBeNull()
    expect(decodeClient(new Uint8Array([0x7f]).buffer)).toBeNull()
  })
})

describe('room → game', () => {
  it('round-trips welcome, join, leave, count, correct', () => {
    expect(decodeServer(encodeWelcome(7, true, 70001))).toEqual({ op: Op.Welcome, slot: 7, member: true, tick: 70001 & 0xffff, tookOver: false })
    expect(decodeServer(encodeWelcome(2, true, 5, true))).toMatchObject({ member: true, tookOver: true })
    expect(decodeServer(encodeJoin([{ slot: 3, uid }]))).toEqual({ op: Op.Join, people: [{ slot: 3, uid }] })
    expect(decodeServer(encodeLeave([3, 9]))).toEqual({ op: Op.Leave, slots: [3, 9] })
    expect(decodeServer(encodeCount(42))).toEqual({ op: Op.Count, members: 42 })
    expect(decodeServer(encodeCorrect(1.5, -2))).toEqual({ op: Op.Correct, x: 1.5, z: -2 })
  })

  it('round-trips a snapshot, including someone leaving the radius', () => {
    const m = decodeServer(
      encodeSnap(12, [
        { slot: 1, qx: qPos(3.21), qz: qPos(-4), qyaw: qYaw(0), anim: 1, gone: false },
        { slot: 2, qx: 0, qz: 0, qyaw: 0, anim: 0, gone: true },
      ]),
    )
    expect(m).toMatchObject({
      op: Op.Snap,
      tick: 12,
      entries: [
        { slot: 1, x: 3.21, z: -4, anim: 1, gone: false },
        { slot: 2, gone: true },
      ],
    })
  })

  it('rejects a truncated snapshot', () => {
    const buf = encodeSnap(1, [{ slot: 1, qx: 0, qz: 0, qyaw: 0, anim: 0, gone: false }])
    expect(decodeServer(buf.slice(0, buf.byteLength - 1))).toBeNull()
  })

  it('keeps facing in 0–255 for any angle', () => {
    for (const a of [-10, -Math.PI, 0, 0.001, Math.PI * 2, 50]) {
      const q = qYaw(a)
      expect(q).toBeGreaterThanOrEqual(0)
      expect(q).toBeLessThan(256)
    }
  })
})

describe('room names', () => {
  it('round-trips and refuses unknown districts', () => {
    expect(parseRoom(roomName('hsr', 2))).toEqual({ district: 'hsr', shard: 2 })
    expect(parseRoom('whitefield#1')).toBeNull()
    expect(parseRoom('koramangala#0')).toBeNull()
    expect(parseRoom('koramangala')).toBeNull()
  })
})
