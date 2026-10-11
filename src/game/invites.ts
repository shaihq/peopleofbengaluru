import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { GATE_MOCK } from './access'

// YOUR INVITES (CLAUDE.md Phase 5D, supabase/migrations/0007_invites.sql). Every member holds a couple of
// codes; turning one into a link marks it sent and starts the 30-day clock. A link unused for 30 days dies
// and the slot comes back as a fresh code (my_invites does that on load). `?gatepreview` mocks it all.

export type Slot = {
  code: string
  state: 'available' | 'sent' | 'used'
  /** Who it's for (≤ 40), set when the link was made. */
  note: string | null
  sent_at: string | null
  expires_at: string | null
  /** On a fresh code that replaced an unused link: who that link was for ('' = no name). */
  renewed_from: string | null
  joined: { name: string; role: string | null; at: string } | null
}

type Invites = {
  slots: Slot[]
  loaded: boolean
  error: boolean
  busy: boolean
  load: () => Promise<void>
  /** A ready code → a sent link. */
  create: (code: string, note: string) => Promise<{ ok: boolean }>
  reset: () => void
}

export const NOTE_MAX = 40

export const inviteLink = (code: string) => `${window.location.origin}/?invite=${code}`

/** "27 DAYS LEFT" */
export function daysLeft(iso: string | null) {
  if (!iso) return ''
  const d = Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000))
  return d === 1 ? '1 DAY LEFT' : `${d} DAYS LEFT`
}

const day = 86_400_000
const mockSlots = (): Slot[] => [
  { code: 'BLR-7HQ2KD', state: 'available', note: null, sent_at: null, expires_at: null, renewed_from: 'Rohan', joined: null },
  {
    code: 'BLR-M4XP9T',
    state: 'sent',
    note: 'Priya',
    sent_at: new Date(Date.now() - 3 * day).toISOString(),
    expires_at: new Date(Date.now() + 27 * day).toISOString(),
    renewed_from: null,
    joined: null,
  },
  {
    code: 'BLR-Q8RN3C',
    state: 'used',
    note: 'Arjun',
    sent_at: new Date(Date.now() - 12 * day).toISOString(),
    expires_at: null,
    renewed_from: null,
    joined: { name: 'Arjun Rao', role: 'Design Engineer', at: new Date(Date.now() - 9 * day).toISOString() },
  },
]

export const useInvites = create<Invites>((set, get) => ({
  slots: [],
  loaded: false,
  error: false,
  busy: false,

  load: async () => {
    if (GATE_MOCK) {
      if (!get().loaded) set({ slots: mockSlots(), loaded: true, error: false })
      return
    }
    if (!supabase) return set({ error: true })
    const { data, error } = await supabase.rpc('my_invites')
    if (error) return set({ error: true })
    set({ slots: (data as Slot[]) ?? [], loaded: true, error: false })
  },

  create: async (code, note) => {
    set({ busy: true })
    const n = note.trim().slice(0, NOTE_MAX) || null
    if (GATE_MOCK) {
      await new Promise((r) => setTimeout(r, 400))
      const now = Date.now()
      set((s) => ({
        busy: false,
        slots: s.slots.map((x) =>
          x.code === code
            ? { ...x, state: 'sent', note: n, renewed_from: null, sent_at: new Date(now).toISOString(), expires_at: new Date(now + 30 * day).toISOString() }
            : x,
        ),
      }))
      return { ok: true }
    }
    if (!supabase) {
      set({ busy: false })
      return { ok: false }
    }
    const { data, error } = await supabase.rpc('create_invite_link', { p_code: code, p_note: n ?? '' })
    const ok = !error && !!(data as { ok?: boolean } | null)?.ok
    await get().load()
    set({ busy: false })
    return { ok }
  },

  reset: () => set({ slots: [], loaded: false, error: false, busy: false }),
}))
