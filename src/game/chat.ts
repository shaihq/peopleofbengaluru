import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useConnect } from './connect'
import { useDirectory } from './people/directory'

// CHAT (CLAUDE.md Phase 5G): one thread per match, inside the city. Messages are written through
// send_message() and read through thread_messages() (supabase/migrations/0009_chat.sql). New ones
// arrive live on your own private channel "user:<id>"; if that channel is down, the minute-by-minute
// refresh in Session.tsx still brings them in.

export type Msg = {
  id: string
  connection_id: string
  sender_id: string
  body: string
  created_at: string
  /** sent from this tab, not confirmed yet */
  pending?: boolean
  /** couldn't be sent: why */
  failed?: string
}

/** Longest message (same as the database). */
export const MSG_MAX = 500
const PAGE = 50

const SEND_ERRORS: Record<string, string> = {
  not_found: 'NOT SENT · THIS CHAT HAS ENDED',
  not_member: 'NOT SENT · ONLY PEOPLE IN THE CITY CAN CHAT',
  too_long: `NOT SENT · KEEP IT UNDER ${MSG_MAX} CHARACTERS`,
  slow_down: 'NOT SENT · THAT’S A LOT OF MESSAGES, GIVE IT A MINUTE',
  error: 'NOT SENT',
}

type ChatState = {
  /** loaded threads, oldest first */
  threads: Record<string, Msg[]>
  /** older messages exist on the server */
  more: Record<string, boolean>
  /** a thread that couldn't be loaded */
  failed: Record<string, boolean>
  live: boolean
}

export const useChat = create<ChatState>(() => ({ threads: {}, more: {}, failed: {}, live: false }))

const sortMsgs = (a: Msg, b: Msg) => a.created_at.localeCompare(b.created_at)

/** Adds or replaces messages by id; a confirmed copy of a message sent from here replaces its pending one. */
function upsert(connId: string, incoming: Msg[]) {
  useChat.setState((s) => {
    let list = s.threads[connId]
    if (!list) return s
    for (const m of incoming) {
      if (list.some((x) => x.id === m.id)) continue
      const tmp = list.findIndex((x) => x.pending && x.sender_id === m.sender_id && x.body === m.body)
      list = tmp >= 0 ? list.map((x, i) => (i === tmp ? m : x)) : [...list, m]
    }
    return { threads: { ...s.threads, [connId]: [...list].sort(sortMsgs) } }
  })
}

/** Opens a thread: the last messages, then marks it read. */
export async function openThread(connId: string) {
  useConnect.getState().showThread(connId)
  if (!supabase) return
  const { data, error } = await supabase.rpc('thread_messages', {
    p_conn: connId,
    p_limit: PAGE,
  })
  if (error) return useChat.setState((s) => ({ failed: { ...s.failed, [connId]: true } }))
  const list = (data ?? []) as Msg[]
  useChat.setState((s) => {
    // keep anything sent from here that the server hasn't confirmed yet
    const local = (s.threads[connId] ?? []).filter((m) => m.pending || m.failed)
    return {
      threads: { ...s.threads, [connId]: [...list, ...local].sort(sortMsgs) },
      more: { ...s.more, [connId]: list.length === PAGE },
      failed: { ...s.failed, [connId]: false },
    }
  })
  useConnect.getState().threadRead(connId)
}

/** Scrolling up: the page before the oldest loaded message. */
export async function loadOlder(connId: string) {
  const list = useChat.getState().threads[connId]
  const oldest = list?.find((m) => !m.pending && !m.failed)
  if (!supabase || !oldest || !useChat.getState().more[connId]) return
  const { data, error } = await supabase.rpc('thread_messages', {
    p_conn: connId,
    p_before: oldest.created_at,
    p_limit: PAGE,
  })
  if (error) return
  const older = (data ?? []) as Msg[]
  useChat.setState((s) => ({
    threads: {
      ...s.threads,
      [connId]: [...older, ...(s.threads[connId] ?? [])],
    },
    more: { ...s.more, [connId]: older.length === PAGE },
  }))
}

/** Sends at once on screen, confirms with the server; a failure stays visible with a retry. */
export async function sendMessage(connId: string, raw: string, retryId?: string) {
  const me = useDirectory.getState().userId
  const body = raw.trim()
  if (!supabase || !me || !body) return
  const tmpId = retryId ?? `tmp-${crypto.randomUUID()}`
  const tmp: Msg = {
    id: tmpId,
    connection_id: connId,
    sender_id: me,
    body,
    created_at: new Date().toISOString(),
    pending: true,
  }
  useChat.setState((s) => ({
    threads: {
      ...s.threads,
      [connId]: [...(s.threads[connId] ?? []).filter((m) => m.id !== tmpId), tmp],
    },
  }))

  const { data, error } = await supabase.rpc('send_message', {
    p_conn: connId,
    p_body: body,
  })
  const r = (data ?? null) as {
    ok: boolean
    state: string
    message?: Msg
  } | null
  if (error || !r?.ok || !r.message) {
    const why = SEND_ERRORS[r?.state ?? 'error'] ?? SEND_ERRORS.error
    useChat.setState((s) => ({
      threads: {
        ...s.threads,
        [connId]: (s.threads[connId] ?? []).map((m) => (m.id === tmpId ? { ...m, pending: false, failed: why } : m)),
      },
    }))
    if (r?.state === 'not_found') void useConnect.getState().load()
    return
  }
  const real = r.message
  useChat.setState((s) => {
    const list = s.threads[connId] ?? []
    // the live channel may have delivered the confirmed copy first
    const next = list.some((m) => m.id === real.id) ? list.filter((m) => m.id !== tmpId) : list.map((m) => (m.id === tmpId ? real : m))
    return { threads: { ...s.threads, [connId]: next } }
  })
  useConnect.getState().messageArrived(real, true)
}

/** A message arrived on the live channel (yours from another tab, or theirs). */
function onMessage(m: Msg) {
  upsert(m.connection_id, [m])
  useConnect.getState().messageArrived(m, m.sender_id === useDirectory.getState().userId)
}

let channel: RealtimeChannel | null = null
let channelUid: string | null = null

/** Listen on your own private channel while you're a member; no-op if already listening. */
export async function startChat() {
  const uid = useDirectory.getState().userId
  const member = useDirectory.getState().me?.status === 'approved'
  if (!supabase || !uid || !member) return stopChat()
  if (channel && channelUid === uid) return
  stopChat()
  channelUid = uid
  // private channels check RLS on realtime.messages with your login
  await supabase.realtime.setAuth()
  if (channelUid !== uid) return
  channel = supabase
    .channel(`user:${uid}`, { config: { private: true } })
    .on('broadcast', { event: 'message' }, ({ payload }) => onMessage(payload as Msg))
    .on('broadcast', { event: 'connections' }, () => void useConnect.getState().load())
    .subscribe((status) => {
      const live = status === 'SUBSCRIBED'
      useConnect.getState().setLive(live)
      useChat.setState({ live })
      // back after a drop: catch up on what was missed
      if (live) {
        void useConnect.getState().load()
        const t = useConnect.getState().threadId
        if (t) void openThread(t)
      }
    })
}

export function stopChat() {
  if (channel) void supabase?.removeChannel(channel)
  channel = null
  channelUid = null
  useConnect.getState().setLive(false)
  useChat.setState({ threads: {}, more: {}, failed: {}, live: false })
}

if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  ;(window as unknown as { __chat?: typeof useChat }).__chat = useChat
}

/** Block: ends the match, deletes the chat for both, and neither of you can ask again. */
export async function blockMember(otherId: string) {
  if (!supabase) return false
  const { data, error } = await supabase.rpc('block_member', {
    p_other: otherId,
  })
  await useConnect.getState().ended()
  return !error && !!(data as { ok?: boolean } | null)?.ok
}

/** Report: the admins get a copy of the request and the last messages, then it blocks. */
export async function reportMember(connId: string, reason: string) {
  if (!supabase) return false
  const { data, error } = await supabase.rpc('report_member', {
    p_conn: connId,
    p_reason: reason.trim() || null,
  })
  await useConnect.getState().ended()
  return !error && !!(data as { ok?: boolean } | null)?.ok
}
