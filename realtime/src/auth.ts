import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { Env } from './env'

// Who is connecting (CLAUDE.md Phase 8A). The live city is for approved members only: everyone else is
// refused. The Supabase login token is checked against the project's PUBLIC signing keys (ES256, cached),
// then their own profile is read with their own token — the same RLS the game uses. No secrets here, and
// tokens are never logged or stored.

export type Member = { uid: string; exp: number }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PROFILE_TTL_MS = 10 * 60_000
/** Load-test bots stay connected this long (they have no real token to expire). */
const BOT_SESSION_S = 2 * 3600

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null
let jwksFor = ''
const statusCache = new Map<string, { member: boolean; at: number }>()

function keys(env: Env) {
  if (!jwks || jwksFor !== env.SUPABASE_URL) {
    jwks = createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`), { cooldownDuration: 60_000 })
    jwksFor = env.SUPABASE_URL
  }
  return jwks
}

async function isApproved(env: Env, uid: string, token: string) {
  const hit = statusCache.get(uid)
  if (hit && Date.now() - hit.at < PROFILE_TTL_MS) return hit.member
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}&select=status`, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`profile ${res.status}`)
  const rows = (await res.json()) as { status?: string }[]
  const member = rows[0]?.status === 'approved'
  statusCache.set(uid, { member, at: Date.now() })
  return member
}

/** Load-test bots (dev/staging only): "loadtest:<secret>:<n>"; on local dev, also "loadtest:<secret>:<member id>". */
function bot(env: Env, token: string): Member | null {
  const [, secret, n = ''] = token.split(':')
  if (!env.LOADTEST_SECRET || env.ENV_NAME === 'production' || secret !== env.LOADTEST_SECRET) return null
  const exp = Math.floor(Date.now() / 1000) + BOT_SESSION_S
  // standing in for a real member only on a local machine — never on a deployed server
  if (UUID.test(n)) return env.ENV_NAME === 'dev' ? { uid: n.toLowerCase(), exp } : null
  const i = Math.max(0, Math.min(0xffffff, Number(n) || 0))
  return { uid: `00000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`, exp }
}

/** An approved member, or null (no token, bad token, expired, not approved, or Supabase unreachable). */
export async function member(env: Env, token: string): Promise<Member | null> {
  if (!token || token.length > 4096) return null
  if (token.startsWith('loadtest:')) return bot(env, token)
  try {
    const { payload } = await jwtVerify(token, keys(env), {
      issuer: `${env.SUPABASE_URL}/auth/v1`,
      audience: 'authenticated',
      algorithms: ['ES256'],
      requiredClaims: ['sub', 'exp'],
    })
    const uid = typeof payload.sub === 'string' && UUID.test(payload.sub) ? payload.sub.toLowerCase() : null
    if (!uid || typeof payload.exp !== 'number') return null
    return (await isApproved(env, uid, token)) ? { uid, exp: payload.exp } : null
  } catch {
    return null
  }
}

/** The bearer token on an HTTP request. */
export const bearer = (req: Request) => req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
