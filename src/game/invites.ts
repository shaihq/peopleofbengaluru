import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { GATE_MOCK } from './access'

// YOUR INVITES (CLAUDE.md Phase 5D, supabase/migrations/20261008102020_invites.sql). Every member holds a couple of
// codes; copying or sharing one marks it sent and starts the 30-day clock. A link unused for 30 days dies
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
  /** Someone used one of your codes since the last load: the HUD ticket names them (n changes each time). */
  news: { n: number; name: string } | null
  load: () => Promise<void>
  /** A code was copied or shared: mark it sent, which starts its 30-day clock (unused, it's replaced). */
  sent: (code: string) => Promise<void>
  reset: () => void
}

export const inviteLink = (code: string) => `${window.location.origin}/?invite=${code}`

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
  news: null,

  load: async () => {
    if (GATE_MOCK) {
      if (!get().loaded) set({ slots: mockSlots(), loaded: true, error: false })
      return
    }
    if (!supabase) return set({ error: true })
    const { data, error } = await supabase.rpc('my_invites')
    if (error) return set({ error: true })
    const slots = (data as Slot[]) ?? []
    const prev = get()
    // only news against a list we already had (the first load isn't an arrival)
    const fresh = prev.loaded ? slots.find((s) => s.joined && !prev.slots.some((p) => p.code === s.code && p.joined)) : undefined
    set({ slots, loaded: true, error: false, ...(fresh ? { news: { n: (prev.news?.n ?? 0) + 1, name: fresh.joined!.name } } : {}) })
  },

  sent: async (code) => {
    const at = Date.now()
    const mark = () =>
      set((s) => ({
        slots: s.slots.map((x) =>
          x.code === code && x.state === 'available'
            ? { ...x, state: 'sent', renewed_from: null, sent_at: new Date(at).toISOString(), expires_at: new Date(at + 30 * day).toISOString() }
            : x,
        ),
      }))
    if (GATE_MOCK) return mark()
    if (!supabase) return
    const { data, error } = await supabase.rpc('create_invite_link', { p_code: code, p_note: '' })
    if (!error && (data as { ok?: boolean } | null)?.ok) mark()
  },

  reset: () => set({ slots: [], loaded: false, error: false, news: null }),
}))
