import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getPeople, useDirectory } from './people/directory'
import { redeemInvite, sendMagicLink, useOnboarding } from './onboarding'
import { useGame } from './store'

// THE GATE (CLAUDE.md Phase 5D). Being visible is earned: an invite code (instant) or
// an application that is paid for and reviewed.
//
// 5D-B: invite codes are real (supabase/migrations/0002_access.sql). Applications open
// with payments (5D-C) — until then "Apply to join" shows as coming soon.
// `?gatepreview` swaps in local mocks for every state, payment path included.

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null

/** Preview mode: nothing is stored, charged or emailed; every screen is reachable. */
export const GATE_MOCK = !!params?.has('gatepreview')
/** "Apply to join" opens with Dodo Payments (5D-C). */
export const PAY_OPEN = GATE_MOCK

/** Where this person stands. Only `visible` can be seen by others. */
export type AccessStatus = 'ghost' | 'review' | 'visible' | 'rejected'
export type Path = 'invite' | 'pay'
/** gate → (code) → numbered steps → result */
export type Stage = 'gate' | 'code' | 'steps' | 'result'
export type Result = 'inbox' | 'review' | 'rejected' | 'approved'

export type CodeState = 'idle' | 'checking' | 'ok' | 'invalid' | 'used' | 'expired' | 'own' | 'error'
export type Inviter = { name: string; role: string }

export const CODE_PREFIX = 'BLR-'
export const CODE_LEN = 6

/** Test codes for ?gatepreview. */
export const MOCK_CODES: Record<string, Exclude<CodeState, 'idle' | 'checking' | 'error'>> = {
  'BLR-4K7Q9M': 'ok',
  'BLR-USED42': 'used',
  'BLR-OLD123': 'expired',
  'BLR-MINE77': 'own',
}

export const CODE_ERRORS: Partial<Record<CodeState, string>> = {
  invalid: 'That code doesn’t exist. Check for typos — codes look like BLR-4K7Q9M.',
  used: 'Someone has already used this code. Ask your inviter for a fresh one.',
  expired: 'This invite expired (they last 30 days once sent). Ask for a new one.',
  own: 'That’s one of your own codes — share it with someone you’d vouch for.',
  error: 'Couldn’t check the code right now. Check your connection and try again.',
}

/** Uppercase, strip spaces, accept a pasted invite link, and keep the BLR- prefix. */
export function normCode(raw: string) {
  const fromLink = raw.match(/[?&]invite=([A-Za-z0-9-]+)/)?.[1]
  let c = (fromLink ?? raw).toUpperCase().replace(/[^A-Z0-9-]/g, '')
  if (c.startsWith('BLR')) c = c.slice(3)
  c = c.replace(/-/g, '').slice(0, CODE_LEN)
  return CODE_PREFIX + c
}

type Access = {
  status: AccessStatus
  stage: Stage
  path: Path | null
  result: Result | null
  code: string
  codeState: CodeState
  inviter: Inviter | null
  /** From an invite link (?invite=CODE): pre-fills the gate. */
  linkCode: string | null
  /** Called when "Become visible" opens. Members skip the gate entirely. */
  open: (member: boolean) => void
  choose: (path: Path) => void
  setStage: (s: Stage) => void
  setCode: (c: string) => void
  checkCode: () => Promise<void>
  /** End of the numbered steps. */
  finish: () => Promise<void>
  setStatus: (s: AccessStatus) => void
}

const previewInviter = (): Inviter => {
  const p = getPeople().find((x) => x.sample) ?? getPeople()[0]
  return p ? { name: p.name, role: p.role } : { name: 'A member', role: 'Designer' }
}

export const useAccess = create<Access>((set, get) => ({
  status: 'ghost',
  stage: 'gate',
  path: null,
  result: null,
  code: CODE_PREFIX,
  codeState: 'idle',
  inviter: null,
  linkCode: null,

  open: (member) => {
    const { status, linkCode } = get()
    if (member) return set({ stage: 'steps', path: null, result: null })
    // an application in flight shows its status instead of the gate
    if (status === 'review') return set({ stage: 'result', result: 'review' })
    if (status === 'rejected') return set({ stage: 'result', result: 'rejected' })
    if (status === 'visible') return set({ stage: 'result', result: 'approved' })
    if (linkCode) {
      set({ stage: 'code', path: 'invite', code: linkCode, codeState: 'idle', result: null })
      void get().checkCode()
      return
    }
    set({ stage: 'gate', path: null, result: null })
  },

  choose: (path) => set(path === 'invite' ? { path, stage: 'code', codeState: 'idle' } : { path, stage: 'steps' }),
  setStage: (stage) => set({ stage }),
  setCode: (c) => set({ code: normCode(c), codeState: 'idle' }),

  // exists / unused / not expired / not yours — checked on the server, nothing is used up
  checkCode: async () => {
    const code = get().code
    if (code.length < CODE_PREFIX.length + CODE_LEN) return set({ codeState: 'invalid' })
    set({ codeState: 'checking' })
    if (GATE_MOCK || !supabase) {
      await new Promise((r) => setTimeout(r, 650))
      const state = GATE_MOCK ? (MOCK_CODES[code] ?? 'invalid') : 'error'
      return set({ codeState: state, inviter: state === 'ok' ? previewInviter() : null })
    }
    const { data, error } = await supabase.rpc('check_invite', { p_code: code })
    if (get().code !== code) return // retyped while checking
    if (error) return set({ codeState: 'error', inviter: null })
    const r = data as { state: CodeState; inviter_name?: string; inviter_role?: string }
    set({
      codeState: r.state,
      inviter: r.state === 'ok' ? { name: r.inviter_name ?? 'A member', role: r.inviter_role ?? '' } : null,
    })
  },

  // invite → signed in: use the code now · otherwise: email the link, use the code on return
  finish: async () => {
    const { path, code } = get()
    if (GATE_MOCK) {
      if (path === 'invite') set({ stage: 'result', result: 'inbox' })
      else set({ stage: 'result', result: 'review', status: 'review' })
      return
    }
    if (path !== 'invite') return // applications open with payments (5D-C)
    const ob = useOnboarding.getState()
    ob.patch({ pendingInvite: code })
    if (useDirectory.getState().userId) {
      ob.patch({ pendingSubmit: true })
      const r = await redeemInvite()
      if (r.ok) {
        // you're a member now: close the flow and land in the city, visible
        set({ stage: 'gate', path: null, status: 'visible', linkCode: null })
        useGame.getState().endCreate()
        useGame.getState().showToast('YOU’RE LIVE · WELCOME TO THE CITY', 'good')
      }
      return
    }
    await sendMagicLink(ob.draft.email)
    if (useOnboarding.getState().mail === 'sent') set({ stage: 'result', result: 'inbox' })
  },

  setStatus: (status) => set({ status }),
}))

// Invite links: ?invite=BLR-4K7Q9M · Preview states: ?gatepreview&access=review|rejected|approved
if (params) {
  const inv = params.get('invite')
  if (inv) useAccess.setState({ linkCode: normCode(inv) })
  const a = params.get('access')
  if (GATE_MOCK && (a === 'review' || a === 'rejected' || a === 'ghost')) useAccess.setState({ status: a })
  if (GATE_MOCK && a === 'approved') useAccess.setState({ status: 'visible' })
  if (process.env.NODE_ENV !== 'production') (window as unknown as { __access?: typeof useAccess }).__access = useAccess
}
