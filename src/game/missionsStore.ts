import { create } from 'zustand'
import { useDirectory } from './people/directory'
import { useMyStatus } from './status'
import { useConnect } from './connect'
import { useInvites } from './invites'
import { useGame } from './store'
import { isPhone } from './device'
import { MISSIONS, latch, type MissionId } from './missions'

// DAY ZERO missions, following the game. No table of their own: each is worked out from data the game
// already has, then remembered in this browser so it never un-completes (a note that expires still counts).
// `?missionspreview` shows them to anyone, on mock progress (tap a line to complete it).

// on a new device, missions already done come back from the server as it loads: no stamps for those
const QUIET_MS = 4000

type Saved = { done: MissionId[]; hidden: boolean; retired: boolean }

type Missions = Saved & {
  /** whose missions these are; null = not a member (no missions) */
  userId: string | null
  collapsed: boolean
  /** a mission completed just now: the tracker stamps it and the motif plays (n changes each time) */
  justDone: { id: MissionId; n: number } | null
  since: number
  complete: (id: MissionId) => void
  setHidden: (hidden: boolean) => void
  retire: () => void
  toggle: () => void
}

export const PREVIEW = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('missionspreview')

const key = (uid: string) => `pob.missions.${uid}`

function read(uid: string): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(key(uid)) ?? 'null') as Partial<Saved> | null
    return { done: latch([], Object.fromEntries((s?.done ?? []).map((id) => [id, true]))), hidden: !!s?.hidden, retired: !!s?.retired }
  } catch {
    return { done: [], hidden: false, retired: false }
  }
}

function write(uid: string | null, s: Saved) {
  if (!uid || PREVIEW) return
  try {
    localStorage.setItem(key(uid), JSON.stringify({ done: s.done, hidden: s.hidden, retired: s.retired }))
  } catch {}
}

export const useMissions = create<Missions>((set, get) => ({
  userId: null,
  done: [],
  hidden: false,
  retired: false,
  collapsed: isPhone,
  justDone: null,
  since: 0,

  complete: (id) => {
    const s = get()
    if (!s.userId) return
    const done = latch(s.done, { [id]: true })
    if (done === s.done) return
    const loud = performance.now() - s.since > QUIET_MS
    set({ done, justDone: loud ? { id, n: (s.justDone?.n ?? 0) + 1 } : s.justDone })
    write(s.userId, get())
  },
  setHidden: (hidden) => {
    set({ hidden })
    write(get().userId, get())
  },
  retire: () => {
    set({ retired: true })
    write(get().userId, get())
  },
  toggle: () => set((s) => ({ collapsed: !s.collapsed })),
}))

/** What the game already knows, mission by mission. */
function facts(): Partial<Record<MissionId, boolean>> {
  return {
    note: !!useMyStatus.getState().status,
    reach: useConnect.getState().items.some((c) => c.dir === 'out'),
    invite: useInvites.getState().slots.some((s) => s.state !== 'available'),
  }
}

function check() {
  const f = facts()
  for (const m of MISSIONS) if (f[m.id]) useMissions.getState().complete(m.id)
}

if (typeof window !== 'undefined') {
  const follow = () => {
    const me = useDirectory.getState().me
    const uid = PREVIEW ? 'preview' : me?.status === 'approved' ? me.id : null
    if (uid === useMissions.getState().userId) return
    useMissions.setState({ userId: uid, justDone: null, since: performance.now(), ...(uid ? read(uid) : { done: [], hidden: false, retired: false }) })
    if (uid && !PREVIEW) check()
  }
  follow()
  useDirectory.subscribe(follow)
  if (!PREVIEW) {
    useMyStatus.subscribe(check)
    useConnect.subscribe((s, p) => s.items !== p.items && check())
    useInvites.subscribe((s, p) => s.slots !== p.slots && check())
    // through the portal: counts once you're out the other side
    useGame.subscribe((s, p) => {
      if (s.travel?.stage === 'reveal' && p.travel?.stage !== 'reveal') useMissions.getState().complete('cross')
    })
  }
}
