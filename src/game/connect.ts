import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Intent } from '@/lib/intents'
import { apply, messageToast, whatsNew, type Conn, type Tab } from './connections'
import { useDirectory } from './people/directory'
import { useGame } from './store'

// CONNECT (CLAUDE.md Phase 5G): Discovery → Intent → Mutual match → a chat inside the city.
// This store owns your list of connections: it fetches it, takes events from the chat (a message
// arrived, you read a chat) and toasts what's new. How the list changes is decided in connections.ts;
// the server's rules are in supabase/migrations/0006_connections.sql and 0009_chat.sql; the message
// threads themselves are in chat.ts.

export type { Conn, Tab } from './connections'
export { connWith, groups, landingTab, unseenCount } from './connections'

/** Longest note on a connect request (same as the database). */
export const NOTE_MAX = 200

export const SEND_ERRORS: Record<string, string> = {
  not_member: 'Only people in the city can connect. Become visible first.',
  not_found: 'They’re not in the city any more.',
  cooldown: 'You asked them recently. You can ask again 2 days after your last request.',
  limit: 'That’s today’s connect requests used up. Try again tomorrow.',
  error: 'Couldn’t send it right now. Try again in a moment.',
}

type ConnectState = {
  items: Conn[]
  loaded: boolean
  /** Email me about requests, matches and unread messages (member_settings, owner-only). */
  emails: boolean
  tab: Tab
  /** The match moment on screen. */
  matchId: string | null
  /** The chat open in the Connections screen. */
  threadId: string | null
  /** chat.ts's live channel is up: messages toast as they arrive, not from the next fetch */
  live: boolean
  busy: boolean
  /** The bell rings when this changes (5G-C): a request ('ask') or a match. */
  ring: { n: number; kind: 'ask' | 'match' } | null
  /** The card that slides in when something arrives while you play. */
  arrival: { conn: Conn; more: number } | null
  /** Open the tray on this request/match (scrolled to and highlighted). */
  focus: string | null
  /** Open the tray, optionally on one connection. */
  openTray: (focus?: string | null) => void
  dismissArrival: () => void
  load: () => Promise<void>
  /** A chat message arrived (or you sent one). Marks it read if that chat is on screen; true if it was. */
  messageArrived: (m: { connection_id: string; body: string; created_at: string }, mine: boolean) => boolean
  /** You've read this chat: here at once, on the server shortly after. */
  threadRead: (id: string) => void
  /** A chat ended from this side (blocked, reported): close it and refetch. */
  ended: () => Promise<void>
  setLive: (on: boolean) => void
  loadSettings: () => Promise<void>
  setEmails: (on: boolean) => Promise<void>
  send: (to: string, intent: Intent, note?: string) => Promise<{ ok: boolean; state: string; id?: string }>
  respond: (id: string, accept: boolean) => Promise<{ ok: boolean; state: string }>
  withdraw: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  markSeen: () => Promise<void>
  setTab: (t: Tab) => void
  showMatch: (id: string | null) => void
  showThread: (id: string | null) => void
  reset: () => void
}

const isMember = () => useDirectory.getState().me?.status === 'approved'
/** The Connections screen is open and you can see it. */
const openNow = () => useGame.getState().connectOpen && typeof document !== 'undefined' && document.visibilityState === 'visible'
/** The chat on screen right now, if any. */
const viewing = (): string | null => (openNow() ? useConnect.getState().threadId : null)

let readTimer: ReturnType<typeof setTimeout> | null = null

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

export const useConnect = create<ConnectState>((set, get) => ({
  items: [],
  loaded: false,
  emails: true,
  tab: 'requests',
  matchId: null,
  threadId: null,
  live: false,
  busy: false,
  ring: null,
  arrival: null,
  focus: null,

  load: async () => {
    if (!supabase || !isMember()) return
    const { data, error } = await supabase.rpc('my_connections_v2')
    if (error) return
    const prev = get().items
    const items = apply(prev, { type: 'fetched', items: (data ?? []) as Conn[], viewing: viewing() })
    set({ items, loaded: true })
    // the chat you were in ended (unmatched, blocked, or they left the city)
    const t = get().threadId
    if (t && !items.some((c) => c.id === t && c.state === 'matched')) set({ threadId: null })

    // a new request or match: the bell rings and a card slides in (5G-C)
    const before = new Set(prev.map((c) => `${c.id}:${c.state}`))
    const freshMatches = items.filter((c) => c.dir === 'out' && c.state === 'matched' && !c.seen && !before.has(`${c.id}:matched`))
    const freshAsks = items.filter((c) => c.dir === 'in' && c.state === 'pending' && !c.seen && !before.has(`${c.id}:pending`))
    const fresh = freshMatches.length ? freshMatches : freshAsks
    if (fresh.length) {
      const kind = freshMatches.length ? 'match' : 'ask'
      const newest = [...fresh].sort((a, b) => (b.decided_at ?? b.created_at).localeCompare(a.decided_at ?? a.created_at))[0]
      set({
        ring: { n: (get().ring?.n ?? 0) + 1, kind },
        // the card only when you're out in the city (the screen shows it anyway)
        arrival: useGame.getState().connectOpen ? null : { conn: newest, more: freshMatches.length + freshAsks.length - 1 },
      })
      return
    }
    // anything else new (messages, when the live channel is down) is a toast
    const news = whatsNew(prev, items, get().live)
    if (news) useGame.getState().showToast(news.msg, news.tone)
  },

  messageArrived: (m, mine) => {
    const c = get().items.find((x) => x.id === m.connection_id)
    // a chat this list doesn't know yet (just matched): fetch it
    if (!c) {
      void get().load()
      return false
    }
    const seen = viewing() === m.connection_id
    set({ items: apply(get().items, { type: 'message', connId: c.id, body: m.body, at: m.created_at, mine, viewing: seen }) })
    if (seen && !mine) get().threadRead(c.id)
    else if (!mine) {
      const t = messageToast(c, m.body)
      useGame.getState().showToast(t.msg, t.tone)
    }
    return seen
  },

  threadRead: (id) => {
    set({ items: apply(get().items, { type: 'read', connId: id }) })
    if (readTimer) clearTimeout(readTimer)
    readTimer = setTimeout(() => void supabase?.rpc('mark_read', { p_conn: id }), 400)
  },

  ended: async () => {
    set({ threadId: null, matchId: null })
    await get().load()
  },

  setLive: (live) => set({ live }),

  loadSettings: async () => {
    const uid = useDirectory.getState().userId
    if (!supabase || !uid) return
    const { data } = await supabase.from('member_settings').select('emails').eq('user_id', uid).maybeSingle()
    set({ emails: (data as { emails: boolean } | null)?.emails ?? true })
  },

  setEmails: async (on) => {
    const uid = useDirectory.getState().userId
    if (!supabase || !uid) return
    const was = get().emails
    set({ emails: on })
    const { error } = await supabase.from('member_settings').upsert({ user_id: uid, emails: on })
    if (error) set({ emails: was })
  },

  send: async (to, intent, note = '') => {
    set({ busy: true })
    const r = await post('/api/connect/send', { to, intent, note: note.trim().slice(0, NOTE_MAX) })
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
    set({ matchId: null, threadId: null })
    await get().load()
  },

  markSeen: async () => {
    if (!supabase || !get().items.some((c) => !c.seen)) return
    await supabase.rpc('mark_connections_seen')
    set({ items: get().items.map((c) => ({ ...c, seen: true })) })
  },

  setTab: (tab) => set({ tab }),
  openTray: (focus = null) => {
    set({ focus, arrival: null })
    useGame.getState().setConnectOpen(true)
  },
  dismissArrival: () => set({ arrival: null }),
  showMatch: (matchId) => {
    if (matchId) useGame.getState().setConnectOpen(true)
    set({ matchId })
  },
  showThread: (threadId) => {
    if (threadId) useGame.getState().setConnectOpen(true)
    set({ threadId, matchId: null })
  },
  reset: () => {
    set({ items: [], loaded: false, emails: true, tab: 'requests', matchId: null, threadId: null, live: false, busy: false, ring: null, arrival: null, focus: null })
  },
}))

if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  ;(window as unknown as { __connect?: typeof useConnect }).__connect = useConnect
}
