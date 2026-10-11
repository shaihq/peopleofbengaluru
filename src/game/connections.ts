import { intentOf, type Intent } from '../lib/intents'

// CONNECT (CLAUDE.md Phase 5G): the rules for your list of connections, as plain functions. The store
// (connect.ts) owns the state and the server calls; this module decides how the list changes, what
// counts as new, and how it's grouped. No Supabase, no stores: tested in connections.test.ts.
// (Relative import above, not '@/', so vitest runs it without a config.)

export type Conn = {
  id: string
  /** in: they asked you · out: you asked them */
  dir: 'in' | 'out'
  intent: Intent
  /** The sender's one line with the request (≤ NOTE_MAX), if they wrote one. */
  note: string | null
  /** A decline looks exactly like 'pending' to the sender. */
  state: 'pending' | 'matched'
  created_at: string
  decided_at: string | null
  /** in + pending: you've seen the request · out + matched: you've seen the match */
  seen: boolean
  other: { id: string; name: string; role: string; character: string; location: string }
  last_message_at: string | null
  /** messages from them you haven't read (matches only) */
  unread: number
  last: { body: string; mine: boolean; at: string } | null
}

export type Tab = 'requests' | 'matches' | 'sent'

/** What can happen to the list. */
export type ConnEvent =
  /** a fresh list from the server; the chat you're looking at stays read */
  | { type: 'fetched'; items: Conn[]; viewing: string | null }
  /** a chat message, yours (from this tab or another) or theirs; `viewing`: that chat is open on screen */
  | { type: 'message'; connId: string; body: string; at: string; mine: boolean; viewing: boolean }
  /** you've read this chat */
  | { type: 'read'; connId: string }

export function apply(items: Conn[], e: ConnEvent): Conn[] {
  switch (e.type) {
    case 'fetched':
      return e.items.map((c) => (c.id === e.viewing ? { ...c, unread: 0 } : c))
    case 'message':
      return items.map((c) =>
        c.id === e.connId
          ? {
              ...c,
              last_message_at: e.at,
              last: { body: e.body.slice(0, 120), mine: e.mine, at: e.at },
              unread: e.mine || e.viewing ? 0 : c.unread + 1,
            }
          : c,
      )
    case 'read':
      return items.map((c) => (c.id === e.connId ? { ...c, unread: 0 } : c))
  }
}

export type Toast = { msg: string; tone: 'good' | 'info' }

/**
 * What's new between two looks at the list, as one toast (or none): new matches first, then new
 * requests, then new messages, which only count here when the live channel is down (`live`: they
 * toast as they arrive instead).
 */
export function whatsNew(prev: Conn[], next: Conn[], live: boolean): Toast | null {
  const before = new Set(prev.map((c) => `${c.id}:${c.state}`))
  const matches = next.filter((c) => c.dir === 'out' && c.state === 'matched' && !c.seen && !before.has(`${c.id}:matched`))
  if (matches.length === 1) {
    const m = matches[0]
    return { msg: `IT’S A MATCH · ${m.other.name.toUpperCase()} WANTS TO ${intentOf(m.intent).label} TOO · PRESS C`, tone: 'good' }
  }
  if (matches.length > 1) return { msg: `${matches.length} NEW MATCHES · PRESS C`, tone: 'good' }

  const asks = next.filter((c) => c.dir === 'in' && c.state === 'pending' && !c.seen && !before.has(`${c.id}:pending`))
  if (asks.length === 1) {
    const i = intentOf(asks[0].intent)
    return { msg: `${i.emoji} ${asks[0].other.name.toUpperCase()} WANTS TO ${i.label} · PRESS C`, tone: 'good' }
  }
  if (asks.length > 1) return { msg: `${asks.length} NEW CONNECT REQUESTS · PRESS C`, tone: 'good' }

  if (live) return null
  const was = new Map(prev.map((c) => [c.id, c.unread]))
  const chats = next.filter((c) => was.has(c.id) && c.unread > (was.get(c.id) ?? 0))
  if (chats.length === 1) return { msg: `💬 ${chats[0].other.name.toUpperCase()} · NEW MESSAGE · PRESS C`, tone: 'info' }
  if (chats.length > 1) return { msg: `💬 ${chats.length} CHATS HAVE NEW MESSAGES · PRESS C`, tone: 'info' }
  return null
}

/** The toast for a message that just arrived live. */
export function messageToast(c: Conn, body: string): Toast {
  const line = body.length > 48 ? `${body.slice(0, 46)}…` : body
  return { msg: `💬 ${c.other.name.split(' ')[0].toUpperCase()}: ${line}`, tone: 'info' }
}

/** The three lists on the Connections screen. */
export function groups(items: Conn[]): Record<Tab, Conn[]> {
  return {
    requests: items.filter((c) => c.state === 'pending' && c.dir === 'in'),
    matches: items.filter((c) => c.state === 'matched'),
    sent: items.filter((c) => c.state === 'pending' && c.dir === 'out'),
  }
}

/** Where opening the Connections screen lands: chats that need you, then requests, then any chats. */
export function landingTab(items: Conn[]): Tab {
  if (items.some((c) => c.state === 'matched' && (c.unread > 0 || (c.dir === 'out' && !c.seen)))) return 'matches'
  if (items.some((c) => c.state === 'pending' && c.dir === 'in')) return 'requests'
  if (items.some((c) => c.state === 'matched')) return 'matches'
  return 'requests'
}

/** Badge count: requests you haven't answered + matches you haven't opened + chats with unread messages. */
export const unseenCount = (items: Conn[]) =>
  items.filter((c) => (c.dir === 'in' && c.state === 'pending') || (c.dir === 'out' && c.state === 'matched' && !c.seen) || c.unread > 0)
    .length

/** The connection between you and this person, if any. */
export const connWith = (items: Conn[], personId: string) => items.find((c) => c.other.id === personId)
