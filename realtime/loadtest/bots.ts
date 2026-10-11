// LIVE CITY load test (CLAUDE.md Phase 8A). N bots join one room, walk around at walking pace and send
// their position 10× a second, like real players. Reports how often snapshots arrive and how big they are.
//
//   npm run bots -- --url http://localhost:8787 --n 20
//   npm run bots -- --url https://pob-realtime-staging.<you>.workers.dev --n 150 --secret <LOADTEST_SECRET>
//
// --secret is required: the live city is members only, and bots are members on dev/staging only.

import WebSocket from 'ws'
import { BOUNDS, CLOSE, SEND_HZ, WALK } from '../../shared/net/config'
import { Op, decodeServer, encodeHello, encodePos } from '../../shared/net/protocol'

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? process.argv[i + 1] : d
}
const base = arg('url', 'http://localhost:8787').replace(/\/$/, '')
const n = Number(arg('n', '20'))
const secret = arg('secret', '')
const room = arg('room', 'koramangala#1')
const seconds = Number(arg('seconds', '60'))
const origin = arg('origin', 'http://localhost:3000')
const spread = Number(arg('spread', '30')) // bots walk inside ±spread m, so most are within each other's radius
// --as <member id,…>: the first bots stand in for these real members (dev/staging), so the game draws them
const as = arg('as', '').split(',').filter(Boolean)
// --cx --cz: where in the district they walk (default the middle)
const cx = Number(arg('cx', '0'))
const cz = Number(arg('cz', '0'))

type Stats = { snaps: number[]; bytes: number; msgs: number; welcomed: boolean; closed?: number; corrected: number }
const all: Stats[] = []
const wsBase = base.replace(/^http/, 'ws')

function bot(i: number) {
  const st: Stats = { snaps: [], bytes: 0, msgs: 0, welcomed: false, corrected: 0 }
  all.push(st)
  const ws = new WebSocket(`${wsBase}/room/${encodeURIComponent(room)}`, { headers: { Origin: origin, ...(secret ? { 'x-loadtest': secret } : {}) } })
  ws.binaryType = 'arraybuffer'
  let x = cx + (Math.random() * 2 - 1) * spread
  let z = cz + (Math.random() * 2 - 1) * spread
  let tx = x
  let tz = z
  let last = 0
  let timer: NodeJS.Timeout | null = null

  ws.on('open', () => ws.send(encodeHello(`loadtest:${secret}:${as[i] ?? i}`)))
  ws.on('message', (data: ArrayBuffer) => {
    st.bytes += data.byteLength
    st.msgs++
    const m = decodeServer(data)
    if (!m) return
    if (m.op === Op.Welcome) {
      st.welcomed = true
      timer = setInterval(() => {
        const dx = tx - x
        const dz = tz - z
        const d = Math.hypot(dx, dz)
        if (d < 0.5) {
          tx = Math.max(-BOUNDS + 1, Math.min(BOUNDS - 1, cx + (Math.random() * 2 - 1) * spread))
          tz = Math.max(-BOUNDS + 1, Math.min(BOUNDS - 1, cz + (Math.random() * 2 - 1) * spread))
        } else {
          const step = Math.min(d, WALK / SEND_HZ)
          x += (dx / d) * step
          z += (dz / d) * step
        }
        ws.send(encodePos({ x, z, yaw: Math.atan2(dx, dz), anim: d < 0.5 ? 0 : 1 }))
      }, 1000 / SEND_HZ)
    }
    if (m.op === Op.Snap) {
      const now = performance.now()
      if (last) st.snaps.push(now - last)
      last = now
    }
    if (m.op === Op.Correct) {
      st.corrected++
      x = m.x
      z = m.z
    }
  })
  ws.on('close', (code) => {
    st.closed = code
    if (timer) clearInterval(timer)
  })
  ws.on('error', () => {})
  return ws
}

const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}

const sockets: WebSocket[] = []
for (let i = 0; i < n; i++) {
  sockets.push(bot(i))
  await new Promise((r) => setTimeout(r, 20)) // a quick ramp, like a launch rush
}
console.log(`${n} bots → ${room} on ${base} for ${seconds}s…`)
await new Promise((r) => setTimeout(r, seconds * 1000))

const gaps = all.flatMap((s) => s.snaps)
const welcomed = all.filter((s) => s.welcomed).length
const closes = all.filter((s) => s.closed !== undefined).reduce<Record<string, number>>((a, s) => ((a[s.closed!] = (a[s.closed!] ?? 0) + 1), a), {})
const bytes = all.reduce((a, s) => a + s.bytes, 0)
console.log({
  welcomed: `${welcomed}/${n}`,
  snapshotGapMs: { p50: Math.round(pct(gaps, 50)), p95: Math.round(pct(gaps, 95)), p99: Math.round(pct(gaps, 99)) },
  perBotKBps: +(bytes / n / seconds / 1024).toFixed(2),
  roomOutKBps: +(bytes / seconds / 1024).toFixed(1),
  corrections: all.reduce((a, s) => a + s.corrected, 0),
  closes,
  flooded: closes[CLOSE.FLOOD] ?? 0,
})
for (const ws of sockets) ws.close()
const pass = welcomed === n && pct(gaps, 95) < 150 && !closes[CLOSE.FLOOD]
console.log(pass ? 'PASS' : 'FAIL')
process.exit(pass ? 0 : 1)
