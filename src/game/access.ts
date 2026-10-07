import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getPeople, useDirectory } from './people/directory'
import { redeemInvite, sendMagicLink, submitApplication, useOnboarding } from './onboarding'
import { useGame } from './store'

// THE GATE (CLAUDE.md Phase 5D). Being visible is earned: an invite code (instant) or
// an application that is paid for and reviewed.
//
// 5D-B: invite codes are real (supabase/migrations/0002_access.sql).
// 5E-A: applications are real (supabase/migrations/0003_applications.sql).
// 5E-B: the fee is paid through Dodo Payments (src/app/api/apply/*); a reviewer decides on /admin.
// `?gatepreview` swaps in local mocks for every state, payment path included.

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null

/** Preview mode: nothing is stored, charged or emailed; every screen is reachable. */
export const GATE_MOCK = !!params?.has('gatepreview')
/** Shown until app_settings.application_fee loads. */
const FEE_FALLBACK = '₹599'
const formatFee = (f: { amount: number; currency: string }) =>
  (f.currency === 'INR' ? '₹' : `${f.currency} `) + (f.amount / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })

/** Where this person stands. Only `visible` can be seen by others. `applied` = saved, not paid yet. */
export type AccessStatus = 'ghost' | 'applied' | 'review' | 'visible' | 'rejected'
export type Path = 'invite' | 'pay'
/** gate → (code) → numbered steps → result · signin: returning members and applicants */
export type Stage = 'gate' | 'code' | 'steps' | 'result' | 'signin'
/** unknown: no account with that email (sign-in never creates one) */
export type SigninState = 'idle' | 'sending' | 'sent' | 'unknown' | 'bad' | 'error'

/** Set while a sign-in link is out, so the return trip can say welcome back (Session.tsx). */
export const SIGNIN_KEY = 'pob.signin'
/** inbox: invite link sent · confirm: applicant confirms email · saved: application in, unpaid */
export type Result = 'inbox' | 'confirm' | 'saved' | 'review' | 'rejected' | 'approved'

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
  /** The application fee, formatted ("₹599"). */
  fee: string
  /** Going to the Dodo checkout. */
  paying: boolean
  payError: string | null
  /** The reviewer's note on a decided application. */
  reason: string | null
  signin: SigninState
  /** Open the flow straight on the sign-in screen (from the pause menu). */
  signinNext: boolean
  /** Called when "Become visible" opens. Members skip the gate entirely. */
  open: (member: boolean) => void
  choose: (path: Path) => void
  setStage: (s: Stage) => void
  setCode: (c: string) => void
  checkCode: () => Promise<void>
  /** End of the numbered steps. */
  finish: () => Promise<void>
  setStatus: (s: AccessStatus) => void
  /** Signed in, not a member: pick up an application in flight (5E-A). */
  loadApplication: () => Promise<void>
  /** Saved application → the Dodo checkout (leaves the page). */
  pay: () => Promise<void>
  /** Back from the checkout (?payment_id=…): ask the server what Dodo says. */
  confirmPayment: (paymentId: string) => Promise<void>
  /** Existing account only: email a sign-in link. */
  signIn: (email: string) => Promise<void>
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
  fee: FEE_FALLBACK,
  paying: false,
  payError: null,
  reason: null,
  signin: 'idle',
  signinNext: false,

  open: (member) => {
    const { status, linkCode, signinNext } = get()
    if (member) return set({ stage: 'steps', path: null, result: null, signinNext: false })
    if (signinNext) return set({ stage: 'signin', path: null, result: null, signin: 'idle', signinNext: false })
    // an application in flight shows its status instead of the gate
    if (status === 'applied') return set({ stage: 'result', result: 'saved' })
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
  setStage: (stage) => set(stage === 'signin' ? { stage, signin: 'idle' } : { stage }),
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
    const ob = useOnboarding.getState()
    if (path === 'pay') {
      // signed in: save now · otherwise confirm the email first, save on return (Session.tsx)
      if (useDirectory.getState().userId) {
        const r = await submitApplication()
        if (!r.ok) return
        set({ stage: 'result', result: 'saved', status: 'applied' })
        return get().pay()
      }
      ob.patch({ pendingApply: true, pendingInvite: '' })
      await sendMagicLink(ob.draft.email)
      if (useOnboarding.getState().mail === 'sent') set({ stage: 'result', result: 'confirm' })
      return
    }
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

  loadApplication: async () => {
    if (GATE_MOCK || !supabase) return
    const { userId, me } = useDirectory.getState()
    if (!userId || me) return
    const { data } = await supabase
      .from('applications')
      .select('status, reason')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const row = data as { status: string; reason: string | null } | null
    const st = row?.status
    if (!st) return
    const status: AccessStatus =
      st === 'draft' || st === 'submitted'
        ? 'applied'
        : st === 'paid' || st === 'under_review'
          ? 'review'
          : st === 'approved'
            ? 'visible'
            : 'rejected'
    set({ status, reason: row?.reason ?? null })
  },

  pay: async () => {
    if (GATE_MOCK) return set({ stage: 'result', result: 'review', status: 'review' })
    if (!supabase) return
    set({ paying: true, payError: null })
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return set({ paying: false, payError: 'Sign in first.' })
    const res = await fetch('/api/apply/checkout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string; status?: string }
    if (body.url) {
      window.location.href = body.url // stays `paying` until the page leaves
      return
    }
    if (body.error === 'already_paid') {
      set({ paying: false })
      return get().loadApplication()
    }
    set({ paying: false, payError: 'Couldn’t open the payment page. Try again in a moment.' })
  },

  confirmPayment: async (paymentId) => {
    if (!supabase) return
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    const res = await fetch('/api/apply/confirm', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_id: paymentId }),
    })
    const body = (await res.json().catch(() => ({}))) as { payment?: string; status?: string }
    const toast = useGame.getState().showToast
    if (body.status === 'under_review') {
      set({ status: 'review' })
      toast('PAYMENT RECEIVED · YOU’RE IN THE REVIEW QUEUE', 'good')
    } else if (body.payment === 'processing' || body.payment === 'requires_customer_action') {
      toast('PAYMENT PROCESSING · WE’LL UPDATE YOU SHORTLY', 'good')
    } else if (body.payment) {
      toast('PAYMENT DIDN’T GO THROUGH · NOTHING WAS CHARGED · TRY AGAIN', 'bad')
    }
    await get().loadApplication()
  },

  // Sign-in never creates an account: new people come in through the gate.
  signIn: async (email) => {
    const e = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return set({ signin: 'bad' })
    set({ signin: 'sending' })
    if (GATE_MOCK) {
      await new Promise((r) => setTimeout(r, 650))
      return set({ signin: 'sent' })
    }
    if (!supabase) return set({ signin: 'error' })
    // a plain sign-in must not finish some half-done flow from an earlier visit
    useOnboarding.getState().patch({ pendingSubmit: false, pendingApply: false, pendingInvite: '' })
    const { error } = await supabase.auth.signInWithOtp({
      email: e,
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
    })
    if (error) {
      const unknown = error.code === 'otp_disabled' || /signups not allowed/i.test(error.message)
      return set({ signin: unknown ? 'unknown' : 'error' })
    }
    try {
      localStorage.setItem(SIGNIN_KEY, '1')
    } catch {}
    set({ signin: 'sent' })
  },
}))

/** Fee label from app_settings (public read). */
if (typeof window !== 'undefined' && supabase && !GATE_MOCK) {
  void supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'application_fee')
    .maybeSingle()
    .then(({ data }) => {
      const f = data?.value as { amount: number; currency: string } | undefined
      if (f?.amount) useAccess.setState({ fee: formatFee(f) })
    })
}

// Invite links: ?invite=BLR-4K7Q9M · Preview states: ?gatepreview&access=applied|review|rejected|approved
if (params) {
  const inv = params.get('invite')
  if (inv) useAccess.setState({ linkCode: normCode(inv) })
  const a = params.get('access')
  if (GATE_MOCK && (a === 'applied' || a === 'review' || a === 'rejected' || a === 'ghost')) useAccess.setState({ status: a })
  if (GATE_MOCK && a === 'approved') useAccess.setState({ status: 'visible' })
  if (process.env.NODE_ENV !== 'production') (window as unknown as { __access?: typeof useAccess }).__access = useAccess
}
