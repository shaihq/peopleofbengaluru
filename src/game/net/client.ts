import { supabase } from '@/lib/supabase'
import { CLOSE, ROOM_DISTRICTS, SEND_HZ } from '@shared/net/config'
import { Op, decodeServer, encodeHello, encodePos, qPos, qYaw, type Anim } from '@shared/net/protocol'
import { player } from '../people/bodies'
import { useDirectory } from '../people/directory'
import { useGame } from '../store'
import { addRemote, clearRemotes, pushSample, remotes } from './remotes'
import { useNet } from './useNet'

// LIVE CITY connection (CLAUDE.md Phase 8A). Approved members only: guests, ghosts and applicants never
// connect (they see everyone wandering, as before). One socket to the room for the district you're in.
// Sends your position 10× a second while it changes; receives the members near you. If anything fails,
// everyone goes back to wandering and the game carries on exactly as before; it reconnects with backoff.

const BASE = (process.env.NEXT_PUBLIC_REALTIME_URL ?? '').replace(/\/$/, '')
export const realtimeEnabled = () => !!BASE
const WS_BASE = BASE.replace(/^http/, 'ws')
const KEEPALIVE_MS = 25_000
const CITY_POLL_MS = 15_000
const MAX_BACKOFF_MS = 30_000

let ws: WebSocket | null = null
let wantDistrict: string | null = null
let gen = 0
let tries = 0
let retry: ReturnType<typeof setTimeout> | null = null
let sender: ReturnType<typeof setInterval> | null = null
let keepalive: ReturnType<typeof setInterval> | null = null
let poller: ReturnType<typeof setInterval> | null = null
let lastCorrect = 0
const slots = new Map<number, string>()
let sent = { qx: NaN, qz: NaN, qyaw: NaN, anim: -1 }

const ANIM_ID: Record<string, Anim> = { idle: 0, walk: 1, run: 2 }

function setLive(fn: (s: Set<string>) => void) {
  const next = new Set(useNet.getState().live)
  fn(next)
  useNet.setState({ live: next })
}

/** Close the socket and forget everyone in it (they go back to wandering). */
function teardown() {
  gen++
  if (sender) clearInterval(sender)
  if (keepalive) clearInterval(keepalive)
  sender = keepalive = null
  if (ws) {
    ws.onclose = ws.onmessage = ws.onopen = ws.onerror = null
    try {
      ws.close(1000)
    } catch {
      // already closed
    }
  }
  ws = null
  slots.clear()
  clearRemotes()
  useNet.setState({ live: new Set(), room: null, hereNow: 0 })
}

function scheduleRetry() {
  if (retry || !wantDistrict) return
  const wait = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** tries) * (0.7 + Math.random() * 0.6)
  tries++
  retry = setTimeout(() => {
    retry = null
    void connect()
  }, wait)
}

async function token() {
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } }
  return data.session?.access_token ?? ''
}

/** Send your position when it changed (2 cm, a facing step, or walk/run/idle). */
function sendPos() {
  if (!ws || ws.readyState !== WebSocket.OPEN || !player.pos) return
  const qx = qPos(player.pos.x)
  const qz = qPos(player.pos.z)
  const qyaw = qYaw(player.facing)
  const anim = ANIM_ID[player.anim] ?? 0
  if (Math.abs(qx - sent.qx) < 2 && Math.abs(qz - sent.qz) < 2 && qyaw === sent.qyaw && anim === sent.anim) return
  sent = { qx, qz, qyaw, anim }
  ws.send(encodePos({ x: player.pos.x, z: player.pos.z, yaw: player.facing, anim }))
}

async function connect() {
  const district = wantDistrict
  if (!district || !BASE) return
  teardown()
  const my = gen
  useNet.setState({ status: 'connecting' })
  try {
    const t = await token()
    if (my !== gen) return
    if (!t) throw new Error('signed out')
    const track = useGame.getState().trackId
    const q = new URLSearchParams({ d: district })
    if (track && /^[0-9a-f-]{36}$/i.test(track)) q.set('with', track)
    const res = await fetch(`${BASE}/assign?${q}`, { headers: { Authorization: `Bearer ${t}` } })
    if (res.status === 401) return notMember()
    if (!res.ok) throw new Error(`assign ${res.status}`)
    const a = (await res.json()) as { room: string; counts: Record<string, number>; rooms: Record<string, number>; online: Record<string, string> }
    if (my !== gen) return
    useNet.setState({ cityCounts: a.counts, cityRooms: a.rooms ?? {}, online: a.online, room: a.room })

    const sock = new WebSocket(`${WS_BASE}/room/${encodeURIComponent(a.room)}`)
    sock.binaryType = 'arraybuffer'
    ws = sock
    sock.onopen = () => sock.send(encodeHello(t))
    sock.onmessage = (e) => {
      if (typeof e.data === 'string') return
      const m = decodeServer(e.data as ArrayBuffer)
      if (!m) return
      switch (m.op) {
        case Op.Welcome:
          tries = 0
          sent = { qx: NaN, qz: NaN, qyaw: NaN, anim: -1 }
          useNet.setState({ status: 'live' })
          sendPos()
          sender = setInterval(sendPos, 1000 / SEND_HZ)
          keepalive = setInterval(() => sock.readyState === WebSocket.OPEN && sock.send('ping'), KEEPALIVE_MS)
          break
        case Op.Join:
          setLive((s) => {
            for (const p of m.people) {
              slots.set(p.slot, p.uid)
              addRemote(p.uid)
              s.add(p.uid)
            }
          })
          break
        case Op.Leave:
          setLive((s) => {
            for (const slot of m.slots) {
              const id = slots.get(slot)
              slots.delete(slot)
              if (!id) continue
              remotes.delete(id)
              s.delete(id)
            }
          })
          break
        case Op.Snap:
          for (const en of m.entries) {
            const id = slots.get(en.slot)
            if (id) pushSample(id, en.x, en.z, en.yaw, en.anim, en.gone)
          }
          break
        case Op.Count:
          useNet.setState({ hereNow: m.members })
          break
        case Op.Correct:
          // the room didn't accept a move (a jump it can't explain): rejoin, which places you where you are
          if (Date.now() - lastCorrect > 5000) {
            lastCorrect = Date.now()
            void connect()
          }
          break
      }
    }
    sock.onclose = (e) => {
      if (my !== gen) return
      teardown()
      if (e.code === CLOSE.NOT_MEMBER) return notMember()
      if (e.code === CLOSE.EXPIRED) {
        // the login token ran out; supabase-js has a fresh one by now
        tries = 0
        void connect()
        return
      }
      if (e.code === CLOSE.REPLACED) {
        // you're live in another tab; this one watches the city without you
        useNet.setState({ status: 'replaced' })
        return
      }
      useNet.setState({ status: 'down' })
      if (e.code === CLOSE.FULL) {
        tries = 0
        void connect()
      } else scheduleRetry()
    }
  } catch {
    if (my !== gen) return
    useNet.setState({ status: 'down' })
    scheduleRetry()
  }
}

/** The room says you're not a member (signed out, or not approved yet): stay off until that changes. */
function notMember() {
  teardown()
  if (retry) clearTimeout(retry)
  retry = null
  useNet.setState({ status: 'off' })
}

async function readCity() {
  if (!BASE || !wantDistrict) return
  try {
    const t = await token()
    if (!t) return
    const res = await fetch(`${BASE}/city`, { headers: { Authorization: `Bearer ${t}` } })
    if (!res.ok) return
    const c = (await res.json()) as { counts: Record<string, number>; rooms: Record<string, number>; online: Record<string, string> }
    useNet.setState({ cityCounts: c.counts, cityRooms: c.rooms ?? {}, online: c.online })
  } catch {
    // counts just stay as they were
  }
}

/** Join the room for this district (null = leave). */
function want(district: string | null) {
  const d = district && (ROOM_DISTRICTS as readonly string[]).includes(district) ? district : null
  if (d === wantDistrict) return
  wantDistrict = d
  if (retry) clearTimeout(retry)
  retry = null
  tries = 0
  if (!d) {
    teardown()
    useNet.setState({ status: 'off' })
    return
  }
  void connect()
}

/** Wire the connection to the game: playing in a district = in its room. Returns a stop function. */
export function startNet() {
  if (!BASE) return () => {}
  // members only: playing in a district, as an approved member, = in its room
  const sync = () => {
    const g = useGame.getState()
    const isMember = useDirectory.getState().me?.status === 'approved'
    want(isMember && g.phase === 'play' && !g.travel ? g.district : null)
  }
  sync()
  const unGame = useGame.subscribe((s, p) => {
    if (s.phase !== p.phase || s.district !== p.district || !!s.travel !== !!p.travel) sync()
  })
  // signing in or out, or being approved, changes who you are in the room: rejoin
  const unDir = useDirectory.subscribe((s, p) => {
    if (s.userId === p.userId && s.me?.status === p.me?.status) return
    const before = wantDistrict
    sync()
    if (before && wantDistrict === before) void connect()
  })
  void readCity()
  poller = setInterval(readCity, CITY_POLL_MS)
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return
    void readCity()
    // back on this tab: rejoin if the connection dropped, or if another tab took over
    if (wantDistrict && (useNet.getState().status === 'down' || useNet.getState().status === 'replaced')) {
      if (retry) clearTimeout(retry)
      retry = null
      tries = 0
      void connect()
    }
  }
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    unGame()
    unDir()
    document.removeEventListener('visibilitychange', onVisible)
    if (poller) clearInterval(poller)
    poller = null
    wantDistrict = null
    if (retry) clearTimeout(retry)
    retry = null
    teardown()
  }
}
