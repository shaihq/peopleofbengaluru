import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { refreshDirectory, rowStatus, useDirectory } from './people/directory'

// STATUS (CLAUDE.md Phase 5F): a short line + an emoji above your head, like a note —
// who's open to being approached, and something to open with.
// Members' statuses live on their profile (note_* columns, migrations/0005_status.sql), so
// everyone sees them. Without an account (?statuspreview) it stays in this browser.

export const STATUS_MAX = 100

export type Status = {
  text: string
  emoji: string
  /** ms since epoch; null = don't clear */
  expiresAt: number | null
}

export type ClearAfter = 'never' | '1h' | '4h' | 'today' | 'week' | 'custom'

export const CLEAR_OPTIONS: { id: ClearAfter; label: string }[] = [
  { id: 'never', label: 'DON’T CLEAR' },
  { id: '1h', label: '1 HOUR' },
  { id: '4h', label: '4 HOURS' },
  { id: 'today', label: 'TODAY' },
  { id: 'week', label: 'THIS WEEK' },
  { id: 'custom', label: 'CUSTOM' },
]

/** Tapping a suggestion fills both the emoji and the text. Nothing is ever picked for you. */
export const SUGGESTIONS: { emoji: string; text: string }[] = [
  { emoji: '☕', text: 'Up for a coffee chat' },
  { emoji: '👀', text: 'Looking for collaborators' },
  { emoji: '💼', text: 'Hiring — ask me about it' },
  { emoji: '🎧', text: 'Heads down — catch me later' },
  { emoji: '🙋', text: 'New here, say hi!' },
  { emoji: '🧪', text: 'Looking for beta testers' },
]

/** Quick picks for desktop. Any emoji can also be typed or pasted into the slot. */
export const EMOJI_GRID = [
  '☕', '👋', '🙋', '👀', '💬', '🤝', '🎧', '🧠',
  '💼', '🚀', '🛠️', '🧪', '🎨', '✏️', '📐', '💡',
  '📚', '🎤', '🎉', '🔥', '✨', '🌱', '🌴', '🏏',
  '🍛', '🥤', '🛵', '🏃', '😴', '🤒', '✈️', '🏠',
]

/** When a "clear after" choice ends, from now. */
export function expiryFor(c: ClearAfter, custom: string, now = new Date()): number | null {
  const t = now.getTime()
  if (c === '1h') return t + 3600_000
  if (c === '4h') return t + 4 * 3600_000
  if (c === 'today') {
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    return end.getTime()
  }
  if (c === 'week') {
    // end of Sunday
    const end = new Date(now)
    end.setDate(end.getDate() + ((7 - end.getDay()) % 7))
    end.setHours(23, 59, 59, 999)
    return end.getTime()
  }
  if (c === 'custom') {
    const v = custom ? new Date(custom).getTime() : NaN
    return Number.isFinite(v) ? v : null
  }
  return null
}

/** A status worth showing: has something in it and hasn't run out. */
export function activeStatus(s: Status | null | undefined, now = Date.now()): Status | null {
  if (!s) return null
  if (!s.text.trim() && !s.emoji.trim()) return null
  if (s.expiresAt !== null && s.expiresAt <= now) return null
  return s
}

/** "until 6:30 PM" · "until Sun" · "" */
export function untilLabel(expiresAt: number | null, now = new Date()): string {
  if (expiresAt === null) return ''
  const d = new Date(expiresAt)
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return `until ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  const days = (expiresAt - now.getTime()) / 86400_000
  if (days < 7) return `until ${d.toLocaleDateString([], { weekday: 'short' })}`
  return `until ${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}`
}

const KEY = 'dob.status'

function load(): Status | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Status) : null
  } catch {
    return null
  }
}

type Result = { ok: boolean; error?: string }

type MyStatus = {
  /** Saved status (may have expired — read it through activeStatus). */
  status: Status | null
  /** What the editor shows right now; your bubble previews it live. */
  draft: Status | null
  saving: boolean
  save: (s: Status) => Promise<Result>
  clear: () => Promise<Result>
  setDraft: (s: Status | null) => void
}

/** Signed in with a profile → the status is stored on it. */
const onProfile = () => !!(supabase && useDirectory.getState().me)

async function store(status: Status | null): Promise<Result> {
  if (!onProfile()) {
    try {
      if (status) localStorage.setItem(KEY, JSON.stringify(status))
      else localStorage.removeItem(KEY)
    } catch {
      // non-critical
    }
    return { ok: true }
  }
  const { error } = await supabase!
    .from('profiles')
    .update({
      note_text: status?.text || null,
      note_emoji: status?.emoji || null,
      note_expires_at: status?.expiresAt ? new Date(status.expiresAt).toISOString() : null,
    })
    .eq('id', useDirectory.getState().me!.id)
  if (error) {
    const msg = error.code === 'PGRST204' || error.code === '42703' ? 'Status isn’t set up on the server yet.' : error.message
    return { ok: false, error: msg }
  }
  await refreshDirectory()
  return { ok: true }
}

export const useMyStatus = create<MyStatus>((set, get) => ({
  status: typeof window === 'undefined' ? null : load(),
  draft: null,
  saving: false,
  save: async (s) => {
    const clean = { ...s, text: s.text.trim().slice(0, STATUS_MAX), emoji: s.emoji.trim() }
    const status = activeStatus(clean)
    const before = get().status
    set({ status, draft: null, saving: true }) // show it straight away
    const r = await store(status)
    set(r.ok ? { saving: false } : { status: before, saving: false })
    return r
  },
  clear: async () => {
    const before = get().status
    set({ status: null, draft: null, saving: true })
    const r = await store(null)
    set(r.ok ? { saving: false } : { status: before, saving: false })
    return r
  },
  setDraft: (draft) => set({ draft }),
}))

// Members: your status comes from your profile (any device). Follow it as it loads/refreshes.
useDirectory.subscribe((d, prev) => {
  if (!d.me || d.me === prev.me || useMyStatus.getState().saving) return
  useMyStatus.setState({ status: rowStatus(d.me) ?? null })
})

/** Keep only the first emoji (grapheme) of whatever was typed or pasted into the slot. */
export function firstEmoji(v: string): string {
  const seg = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null
  const parts = seg ? [...seg.segment(v)].map((x) => x.segment) : Array.from(v)
  return parts.find((p) => /\p{Extended_Pictographic}/u.test(p)) ?? ''
}
