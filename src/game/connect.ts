import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { intentOf, type Intent } from '@/lib/intents'
import { useDirectory } from './people/directory'
import { useGame } from './store'

// CONNECT (CLAUDE.md Phase 5G): Discovery → Intent → Mutual match → Introduction → Take it from here.
// The rules live on the server (supabase/migrations/0006_connections.sql); a contact only ever
// arrives here inside an accepted connection.

export type ContactMethod = 'whatsapp' | 'instagram' | 'email' | 'telegram' | 'linkedin' | 'x'
export type Contact = { method: ContactMethod; value: string }

export const METHODS: { id: ContactMethod; label: string; placeholder: string; hint: string }[] = [
  { id: 'whatsapp', label: 'WHATSAPP', placeholder: '+91 98765 43210', hint: 'Your number, with the country code.' },
  { id: 'instagram', label: 'INSTAGRAM', placeholder: '@yourhandle', hint: 'They’ll DM you on Instagram.' },
  { id: 'email', label: 'EMAIL', placeholder: 'you@studio.com', hint: 'Any address — it doesn’t have to be your sign-in one.' },
  { id: 'telegram', label: 'TELEGRAM', placeholder: '@yourhandle', hint: 'Your Telegram username.' },
  { id: 'linkedin', label: 'LINKEDIN', placeholder: 'linkedin.com/in/you', hint: 'They’ll message you on LinkedIn.' },
  { id: 'x', label: 'X', placeholder: '@handle', hint: 'Make sure your DMs are open.' },
]

const CONTACT_ERRORS: Record<ContactMethod, string> = {
  whatsapp: 'That doesn’t look like a phone number. Include the country code, like +91 98765 43210.',
  instagram: 'That doesn’t look like an Instagram handle.',
  email: 'That doesn’t look like an email address.',
  telegram: 'Telegram usernames are 5–32 letters, numbers or underscores.',
  linkedin: 'Paste your LinkedIn profile link, like linkedin.com/in/you.',
  x: 'X handles are up to 15 letters, numbers or underscores.',
}

export const methodOf = (id: string) => METHODS.find((m) => m.id === id) ?? METHODS[0]

/** The stored form of a contact (same rules as valid_contact() on the server), or null if it isn't valid. */
export function normContact(method: ContactMethod, raw: string): string | null {
  const v = raw.trim()
  const handle = v.replace(/^@/, '').replace(/^https?:\/\/(www\.)?[^/]+\//i, '').replace(/\/.*$/, '')
  switch (method) {
    case 'whatsapp': {
      let d = v.replace(/[^\d+]/g, '')
      if (!d.startsWith('+')) d = d.length === 10 ? `+91${d}` : `+${d}` // a bare 10-digit number is Indian
      return /^\+[1-9]\d{7,14}$/.test(d) ? d : null
    }
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 200 ? v : null
    case 'instagram':
      return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? handle : null
    case 'telegram':
      return /^[A-Za-z0-9_]{5,32}$/.test(handle) ? handle : null
    case 'x':
      return /^[A-Za-z0-9_]{1,15}$/.test(handle) ? handle : null
    case 'linkedin': {
      const u = /^https?:\/\//i.test(v) ? v.replace(/^http:/i, 'https:') : `https://${v}`
      return /^https:\/\/(www\.)?linkedin\.com\/\S+$/i.test(u) && u.length <= 200 ? u : null
    }
  }
}

/** How a contact reads on screen. */
export function contactLabel(c: Contact) {
  if (c.method === 'instagram' || c.method === 'telegram' || c.method === 'x') return `@${c.value}`
  if (c.method === 'linkedin') return c.value.replace(/^https:\/\/(www\.)?/, '')
  return c.value
}

/** Where TAKE IT FROM HERE goes. */
export function contactHref(c: Contact) {
  switch (c.method) {
    case 'whatsapp':
      return `https://wa.me/${c.value.replace(/\D/g, '')}`
    case 'instagram':
      return `https://instagram.com/${c.value}`
    case 'telegram':
      return `https://t.me/${c.value}`
    case 'x':
      return `https://x.com/${c.value}`
    case 'email':
      return `mailto:${c.value}`
    case 'linkedin':
      return c.value
  }
}

export type Conn = {
  id: string
  /** in: they asked you · out: you asked them */
  dir: 'in' | 'out'
  intent: Intent
  /** A decline looks exactly like 'pending' to the sender. */
  state: 'pending' | 'matched'
  created_at: string
  decided_at: string | null
  /** in + pending: you've seen the request · out + matched: you've seen the match */
  seen: boolean
  other: { id: string; name: string; role: string; character: string; location: string }
  contact: Contact | null
}

export type Tab = 'requests' | 'matches' | 'sent'

export const SEND_ERRORS: Record<string, string> = {
  not_member: 'Only people in the city can connect. Become visible first.',
  not_found: 'They’re not in the city any more.',
  cooldown: 'You asked them recently. You can ask again 30 days after your last request.',
  limit: 'That’s today’s connect requests used up. Try again tomorrow.',
  no_contact: 'Add how people can reach you first.',
  error: 'Couldn’t send it right now. Try again in a moment.',
}

type ConnectState = {
  items: Conn[]
  loaded: boolean
  /** Your own preferred contact (owner-only row). */
  contact: (Contact & { emails: boolean }) | null
  contactLoaded: boolean
  tab: Tab
  /** The match moment on screen. */
  matchId: string | null
  busy: boolean
  load: () => Promise<void>
  loadContact: () => Promise<void>
  saveContact: (method: ContactMethod, raw: string) => Promise<{ ok: boolean; error?: string }>
  setEmails: (on: boolean) => Promise<void>
  send: (to: string, intent: Intent) => Promise<{ ok: boolean; state: string; id?: string }>
  respond: (id: string, accept: boolean) => Promise<{ ok: boolean; state: string }>
  withdraw: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  markSeen: () => Promise<void>
  setTab: (t: Tab) => void
  showMatch: (id: string | null) => void
  reset: () => void
}

const isMember = () => useDirectory.getState().me?.status === 'approved'

async function token() {
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } }
  return data.session?.access_token ?? null
}

async function post(path: string, body: unknown) {
  const t = await token()
  if (!t) return { ok: false, state: 'signed_out' }
  const res = await fetch(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => null)
  if (!res) return { ok: false, state: 'error' }
  return ((await res.json().catch(() => null)) ?? { ok: false, state: 'error' }) as { ok: boolean; state: string; id?: string }
}

/** Badge count: requests you haven't answered + matches you haven't opened. */
export const unseenCount = (items: Conn[]) =>
  items.filter((c) => (c.dir === 'in' && c.state === 'pending') || (c.dir === 'out' && c.state === 'matched' && !c.seen)).length

/** The connection between you and this person, if any. */
export const connWith = (items: Conn[], personId: string) => items.find((c) => c.other.id === personId)

export const useConnect = create<ConnectState>((set, get) => ({
  items: [],
  loaded: false,
  contact: null,
  contactLoaded: false,
  tab: 'requests',
  matchId: null,
  busy: false,

  load: async () => {
    if (!supabase || !isMember()) return
    const { data, error } = await supabase.rpc('my_connections')
    if (error) return
    const items = (data ?? []) as Conn[]
    const before = new Set(get().items.map((c) => `${c.id}:${c.state}`))
    set({ items, loaded: true })

    // in-game notifications: what's new since the last look
    const toast = useGame.getState().showToast
    const freshMatches = items.filter((c) => c.dir === 'out' && c.state === 'matched' && !c.seen && !before.has(`${c.id}:matched`))
    const freshAsks = items.filter((c) => c.dir === 'in' && c.state === 'pending' && !c.seen && !before.has(`${c.id}:pending`))
    if (freshMatches.length === 1) {
      const m = freshMatches[0]
      toast(`IT’S A MATCH · ${m.other.name.toUpperCase()} WANTS TO ${intentOf(m.intent).label} TOO · PRESS C`, 'good')
    } else if (freshMatches.length > 1) toast(`${freshMatches.length} NEW MATCHES · PRESS C`, 'good')
    else if (freshAsks.length === 1) {
      const a = freshAsks[0]
      toast(`${intentOf(a.intent).emoji} ${a.other.name.toUpperCase()} WANTS TO ${intentOf(a.intent).label} · PRESS C`, 'good')
    } else if (freshAsks.length > 1) toast(`${freshAsks.length} NEW CONNECT REQUESTS · PRESS C`, 'good')
  },

  loadContact: async () => {
    const uid = useDirectory.getState().userId
    if (!supabase || !uid) return
    const { data } = await supabase.from('contacts').select('method, value, emails').eq('user_id', uid).maybeSingle()
    set({ contact: (data as ConnectState['contact']) ?? null, contactLoaded: true })
  },

  saveContact: async (method, raw) => {
    const uid = useDirectory.getState().userId
    if (!supabase || !uid) return { ok: false, error: 'Sign in first.' }
    const value = normContact(method, raw)
    if (!value) return { ok: false, error: CONTACT_ERRORS[method] }
    const emails = get().contact?.emails ?? true
    const { error } = await supabase.from('contacts').upsert({ user_id: uid, method, value, emails })
    if (error) return { ok: false, error: 'Couldn’t save it. Try again.' }
    set({ contact: { method, value, emails } })
    return { ok: true }
  },

  setEmails: async (on) => {
    const c = get().contact
    const uid = useDirectory.getState().userId
    if (!supabase || !uid || !c) return
    set({ contact: { ...c, emails: on } })
    const { error } = await supabase.from('contacts').update({ emails: on }).eq('user_id', uid)
    if (error) set({ contact: c })
  },

  send: async (to, intent) => {
    set({ busy: true })
    const r = await post('/api/connect/send', { to, intent })
    await get().load()
    set({ busy: false })
    if (r.ok && r.state === 'matched' && r.id) get().showMatch(r.id)
    return r
  },

  respond: async (id, accept) => {
    set({ busy: true })
    const r = await post('/api/connect/respond', { id, accept })
    await get().load()
    set({ busy: false })
    if (r.ok && r.state === 'matched') get().showMatch(id)
    return r
  },

  withdraw: async (id) => {
    if (!supabase) return
    await supabase.rpc('withdraw_connect', { p_id: id })
    await get().load()
  },

  remove: async (id) => {
    if (!supabase) return
    await supabase.rpc('remove_connect', { p_id: id })
    set({ matchId: null })
    await get().load()
  },

  markSeen: async () => {
    if (!supabase || !get().items.some((c) => !c.seen)) return
    await supabase.rpc('mark_connections_seen')
    set({ items: get().items.map((c) => ({ ...c, seen: true })) })
  },

  setTab: (tab) => set({ tab }),
  showMatch: (matchId) => {
    if (matchId) useGame.getState().setConnectOpen(true)
    set({ matchId })
  },
  reset: () => {
    set({ items: [], loaded: false, contact: null, contactLoaded: false, matchId: null })
  },
}))

if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  ;(window as unknown as { __connect?: typeof useConnect }).__connect = useConnect
}
