import { parseRoom } from '../../shared/net/config'
import { bearer, member } from './auth'
import { cityOf, roomOf, type Env } from './env'

export { City } from './city'
export { Room } from './room'

// LIVE CITY entry point (CLAUDE.md Phase 8A). Approved members only.
//   GET /assign?d=koramangala[&with=<uid>]  (Authorization: Bearer <supabase token>) → { room, counts, rooms, online }
//   GET /city                               (Authorization: Bearer <supabase token>) → { counts, rooms, online }
//   GET /room/<district>#<n>  (WebSocket; the token goes in the first message, never the URL)
//   GET /health

function originAllowed(env: Env, origin: string | null) {
  if (!origin) return false
  return env.ALLOWED_ORIGINS.split(',').some((p) => {
    const pat = p.trim()
    if (!pat) return false
    if (!pat.includes('*')) return pat === origin
    const re = new RegExp(`^${pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+')}$`, 'i')
    return re.test(origin)
  })
}

function cors(env: Env, origin: string | null, h = new Headers()) {
  if (origin && originAllowed(env, origin)) {
    h.set('Access-Control-Allow-Origin', origin)
    h.set('Vary', 'Origin')
  }
  return h
}

function json(body: unknown, origin: string | null, env: Env, status = 200) {
  const h = cors(env, origin, new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }))
  return new Response(JSON.stringify(body), { status, headers: h })
}

/** Load-test bots (dev/staging only) send the secret in a header, so it never lands in a logged URL. */
const isBot = (env: Env, req: Request) =>
  !!env.LOADTEST_SECRET && env.ENV_NAME !== 'production' && req.headers.get('x-loadtest') === env.LOADTEST_SECRET

export default {
  async fetch(req, env): Promise<Response> {
    // the load-test door must never exist in production
    if (env.ENV_NAME === 'production' && env.LOADTEST_SECRET) return new Response('misconfigured', { status: 500 })

    const url = new URL(req.url)
    const origin = req.headers.get('Origin')

    if (req.method === 'OPTIONS') {
      if (!originAllowed(env, origin)) return new Response(null, { status: 403 })
      return new Response(null, {
        status: 204,
        headers: cors(
          env,
          origin,
          new Headers({ 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': 'Authorization', 'Access-Control-Max-Age': '86400' }),
        ),
      })
    }
    if (req.method !== 'GET') return new Response('method not allowed', { status: 405 })

    if (url.pathname === '/health') return new Response('ok')

    if (url.pathname === '/assign' || url.pathname === '/city') {
      if (origin && !originAllowed(env, origin)) return new Response('origin not allowed', { status: 403 })
      const m = await member(env, bearer(req))
      if (!m) return json({ error: 'members only' }, origin, env, 401)
      // per person, not per IP: a whole coworking space on one connection must not share a limit
      if (!isBot(env, req)) {
        const { success } = await env.API_LIMIT.limit({ key: m.uid })
        if (!success) return json({ error: 'slow down' }, origin, env, 429)
      }
      const city = cityOf(env)
      if (url.pathname === '/city') return json(await city.read(), origin, env)
      const withUid = url.searchParams.get('with') ?? undefined
      const r = await city.assign(url.searchParams.get('d') ?? '', withUid && /^[0-9a-f-]{36}$/i.test(withUid) ? withUid : undefined)
      return json(r, origin, env)
    }

    if (url.pathname.startsWith('/room/')) {
      const name = decodeURIComponent(url.pathname.slice('/room/'.length))
      if (!parseRoom(name)) return new Response('unknown room', { status: 404 })
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 })
      if (!originAllowed(env, origin)) return new Response('origin not allowed', { status: 403 })
      if (!isBot(env, req)) {
        const { success } = await env.CONNECT_LIMIT.limit({ key: req.headers.get('CF-Connecting-IP') ?? 'unknown' })
        if (!success) return new Response('slow down', { status: 429 })
      }
      const fwd = new Request(req)
      fwd.headers.set('x-room', name)
      fwd.headers.delete('x-loadtest')
      return roomOf(env, name).fetch(fwd)
    }

    return new Response('not found', { status: 404 })
  },
} satisfies ExportedHandler<Env>
