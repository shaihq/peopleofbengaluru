// LIVE CITY security checks (CLAUDE.md Phase 8A). Run against a local or staging room server:
//   npm run abuse -- --url http://localhost:8787 --secret <LOADTEST_SECRET> [--member <real member id>] [--env dev|staging]
//
// Members only: every way in without a valid Supabase login for an approved member must be refused,
// and nothing about who's online may reach a non-member.

import WebSocket from 'ws'
import { SignJWT, UnsecuredJWT, generateKeyPair } from 'jose'
import { CLOSE } from '../../shared/net/config'
import { Op, decodeServer, encodeHello, encodePos } from '../../shared/net/protocol'

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? process.argv[i + 1] : d
}
const base = arg('url', 'http://localhost:8787').replace(/\/$/, '')
const secret = arg('secret', '')
const realMember = arg('member', '')
const envName = arg('env', 'dev')
const origin = arg('origin', 'http://localhost:3000')
const SUPABASE = 'https://taidgykcrdigmmgjyshv.supabase.co'
const REAL_KID = '1479e98d-e774-442b-9044-f7e8ebcb012b'
const room = 'hsr#1'
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Conn = { ws: WebSocket; msgs: ReturnType<typeof decodeServer>[]; closed: () => number | null }

function open(hello: string | ArrayBuffer | null, opts: { o?: string; bot?: boolean } = {}): Promise<Conn> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { Origin: opts.o ?? origin }
    if (opts.bot) headers['x-loadtest'] = secret
    const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/room/${encodeURIComponent(room)}`, { headers })
    ws.binaryType = 'arraybuffer'
    const msgs: ReturnType<typeof decodeServer>[] = []
    let code: number | null = null
    ws.on('message', (d: ArrayBuffer) => msgs.push(decodeServer(d)))
    ws.on('close', (c) => (code = c))
    ws.on('open', () => {
      if (hello !== null) ws.send(typeof hello === 'string' ? encodeHello(hello) : hello)
      resolve({ ws, msgs, closed: () => code })
    })
    ws.on('unexpected-response', (_req, res) => reject(new Error(String(res.statusCode))))
    ws.on('error', () => {})
  })
}

const results: [string, boolean][] = []
const check = (name: string, ok: boolean) => results.push([name, ok])
const refused = (c: Conn) => c.closed() === CLOSE.NOT_MEMBER && !c.msgs.some((m) => m?.op === Op.Welcome || m?.op === Op.Join)

// --- forged and missing logins ---------------------------------------------------------------------
const victim = realMember || '3dc38c47-8dc3-412b-8ee1-f66a28dac6a0'
const now = Math.floor(Date.now() / 1000)
const claims = { sub: victim, aud: 'authenticated', role: 'authenticated', iss: `${SUPABASE}/auth/v1`, exp: now + 3600, iat: now }

const { privateKey } = await generateKeyPair('ES256')
const attackerSigned = await new SignJWT(claims).setProtectedHeader({ alg: 'ES256', kid: REAL_KID }).sign(privateKey)
const unsigned = new UnsecuredJWT(claims).encode()
const hsWithPublicKey = await new SignJWT(claims)
  .setProtectedHeader({ alg: 'HS256' })
  .sign(new TextEncoder().encode('sb_publishable_XQZgF2VVIZ4sdvv8DnwQcA_KuOkyNmv'))
const { privateKey: k2 } = await generateKeyPair('ES256')
const otherIssuer = await new SignJWT({ ...claims, iss: 'https://evil.supabase.co/auth/v1' }).setProtectedHeader({ alg: 'ES256' }).sign(k2)

const attempts: [string, string | ArrayBuffer][] = [
  ['no login', ''],
  ['garbage token', 'not-a-jwt'],
  ['unsigned token (alg none) claiming a real member', unsigned],
  ['token signed with an attacker key, using the real key id', attackerSigned],
  ['HS256 token signed with the public key', hsWithPublicKey],
  ['token from another Supabase project', otherIssuer],
  ['load-test token with the wrong secret', 'loadtest:wrong:1'],
  ['oversized hello (8 KB)', encodeHello('x'.repeat(8192))],
]
const conns = await Promise.all(attempts.map(([, h]) => open(h)))
await wait(5600) // oversized hello is ignored, then the 5 s hello timeout closes it
attempts.forEach(([name], i) => {
  const c = conns[i]
  const ok = name.startsWith('oversized') ? c.closed() === CLOSE.HELLO_TIMEOUT && !c.msgs.length : refused(c)
  check(`refused: ${name}`, ok)
})

const silent = await open(null)
await wait(6000)
// the close message has arrived (CLOSING); the TCP teardown can take a few more seconds
const closing = silent.ws.readyState >= WebSocket.CLOSING
for (let i = 0; i < 30 && silent.closed() === null; i++) await wait(500)
check('refused: connects but never says hello (closed after 5 s)', closing && silent.closed() === CLOSE.HELLO_TIMEOUT)

// --- who's online never reaches a non-member -------------------------------------------------------
for (const path of ['/city', '/assign?d=koramangala']) {
  const anon = await fetch(`${base}${path}`)
  const forged = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${attackerSigned}` } })
  const body = await anon.text()
  check(`${path} without a login → 401, nothing listed`, anon.status === 401 && !body.includes('online') && forged.status === 401)
}

// --- origins ---------------------------------------------------------------------------------------
let foreign = false
try {
  ;(await open('', { o: 'https://evil.example' })).ws.close()
} catch (e) {
  foreign = (e as Error).message === '403'
}
check('a website that isn’t ours can’t open a room', foreign)
let lookalike = false
try {
  ;(await open('', { o: 'http://localhost:3000.evil.example' })).ws.close()
} catch (e) {
  lookalike = (e as Error).message === '403'
}
check('a look-alike origin is refused', lookalike)

// --- members (bots) --------------------------------------------------------------------------------
if (secret) {
  if (envName === 'staging') {
    const imp = await open(`loadtest:${secret}:${victim}`, { bot: true })
    await wait(1200)
    check('staging: a bot can’t stand in for a real member', refused(imp))
  }

  const m = await open(`loadtest:${secret}:900`, { bot: true })
  await wait(600)
  check('a member is welcomed', m.msgs.some((x) => x?.op === Op.Welcome))
  const city = await fetch(`${base}/city`, { headers: { Authorization: `Bearer loadtest:${secret}:900`, 'x-loadtest': secret } })
  check('/city works for a member', city.status === 200)

  m.ws.send(encodePos({ x: 0, z: 0, yaw: 0, anim: 0 }))
  await wait(150)
  m.ws.send(encodePos({ x: 30, z: 30, yaw: 0, anim: 2 }))
  await wait(300)
  check('a teleport is corrected', m.msgs.some((x) => x?.op === Op.Correct && x.x === 0 && x.z === 0))
  m.ws.send(new Uint8Array(200).fill(2).buffer)
  await wait(200)
  check('an oversized message is ignored', m.closed() === null)

  const again = await open(`loadtest:${secret}:900`, { bot: true })
  await wait(800)
  check('the same person joining again replaces the first socket', m.closed() === CLOSE.REPLACED)
  check('the new socket is told it took over', again.msgs.some((x) => x?.op === Op.Welcome && x.tookOver))
  check('a first join is not a take-over', m.msgs.some((x) => x?.op === Op.Welcome && !x.tookOver))

  for (let s = 0; s < 4; s++) {
    for (let i = 0; i < 80; i++) again.ws.send(encodePos({ x: 0, z: 0, yaw: 0, anim: 0 }))
    await wait(1000)
  }
  await wait(300)
  check('a flood of messages is cut off', again.closed() === CLOSE.FLOOD)
}

for (const c of [...conns, silent]) c.ws.close()
for (const [name, ok] of results) console.log(ok ? 'PASS' : 'FAIL', name)
process.exit(results.every(([, ok]) => ok) ? 0 : 1)
