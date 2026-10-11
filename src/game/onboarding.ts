import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { DEFAULT_CHARACTER, genderOf, type Gender } from './characters/roster'
import { refreshDirectory, useDirectory } from './people/directory'

// "Become visible" — character-creation style onboarding (CLAUDE.md §1).
// The draft lives in localStorage so the magic-link round trip never loses it.

export type Draft = {
  /** Collected right after the gate; the sign-in link only goes out once entry is granted. */
  email: string
  character: string
  /** Preferred body — kept when switching between styles. */
  gender: Gender
  name: string
  role: string
  company: string
  building: string
  previously: string
  skills: string
  openToWork: boolean
  portfolio: string
  linkedin: string
  x: string
  location: string
  /** Spot id within the district they appear in. */
  spot: string
  /** Set when we're waiting on a magic link — submit as soon as the session arrives. */
  pendingSubmit: boolean
  /** Invite path: the code to redeem once the session arrives (CLAUDE.md 5D-B). */
  pendingInvite: string
  /** Pay path — the four application questions (CLAUDE.md 5E-A). Only applicants + reviewers see them. */
  appWhy: string
  appWant: string
  appBring: string
  appLink: string
  appLinkWhy: string
  /** Pay path: save the application as soon as the session arrives. */
  pendingApply: boolean
}

export const STEPS = ['PICK YOUR LOOK', 'WHO ARE YOU?', 'WHAT ARE YOU BUILDING?', 'WHERE CAN PEOPLE FIND YOU?', 'WHERE DO YOU HANG OUT?', 'GO LIVE'] as const

/** The numbered steps, by key. Which ones you get depends on how you're getting in. */
export type StepKey = 'email' | 'look' | 'who' | 'building' | 'links' | 'hangout' | 'golive' | 'why' | 'want' | 'bring' | 'show' | 'pay'
export const STEP_TITLE: Record<StepKey, string> = {
  email: 'WHERE DO WE REACH YOU?',
  look: 'PICK YOUR LOOK',
  who: 'WHO ARE YOU?',
  building: 'WHAT ARE YOU BUILDING?',
  links: 'WHERE CAN PEOPLE FIND YOU?',
  hangout: 'WHERE DO YOU HANG OUT?',
  golive: 'GO LIVE',
  why: 'WHY HERE?',
  want: 'WHAT ARE YOU LOOKING FOR?',
  bring: 'WHAT WILL YOU BRING?',
  show: 'SHOW US ONE THING',
  pay: 'SEND YOUR APPLICATION',
}
/** The application: one question per screen, after the profile, before payment (CLAUDE.md 5E). */
export const QUESTION_STEPS: StepKey[] = ['why', 'want', 'bring', 'show']
export const ANSWER_MIN = 20
export const ANSWER_MAX = 400
export const LINK_WHY_MIN = 10
export const LINK_WHY_MAX = 200
const PROFILE_STEPS: StepKey[] = ['look', 'who', 'building', 'links', 'hangout']
/** Members editing (no gate) · invite (instant) · pay (reviewed: profile + four questions). */
export function stepsFor(path: 'invite' | 'pay' | null): StepKey[] {
  if (path === 'invite') return ['email', ...PROFILE_STEPS, 'golive']
  if (path === 'pay') return ['email', ...PROFILE_STEPS, ...QUESTION_STEPS, 'pay']
  return [...PROFILE_STEPS, 'golive']
}

const KEY = 'dob.draft'

const EMPTY: Draft = {
  email: '',
  character: DEFAULT_CHARACTER,
  gender: 'f',
  name: '',
  role: '',
  company: '',
  building: '',
  previously: '',
  skills: '',
  openToWork: false,
  portfolio: '',
  linkedin: '',
  x: '',
  location: 'Koramangala',
  spot: 'darshini',
  pendingSubmit: false,
  pendingInvite: '',
  appWhy: '',
  appWant: '',
  appBring: '',
  appLink: '',
  appLinkWhy: '',
  pendingApply: false,
}

function load(): Draft {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...EMPTY, ...JSON.parse(raw) }
  } catch {
    // ignore — start fresh
  }
  return { ...EMPTY }
}

function save(d: Draft) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d))
  } catch {
    // non-critical
  }
}

type Onboarding = {
  step: number
  draft: Draft
  mail: 'idle' | 'sending' | 'sent' | 'error'
  saving: boolean
  error: string | null
  setStep: (n: number) => void
  patch: (p: Partial<Draft>) => void
  /** Pre-fill from the signed-in player's existing profile. */
  fromProfile: () => void
}

export const useOnboarding = create<Onboarding>((set, get) => ({
  step: 0,
  draft: typeof window === 'undefined' ? { ...EMPTY } : load(),
  mail: 'idle',
  saving: false,
  error: null,
  setStep: (step) => set({ step, error: null }),
  patch: (p) => {
    const draft = { ...get().draft, ...p }
    save(draft)
    set({ draft, error: null })
  },
  fromProfile: () => {
    const me = useDirectory.getState().me
    if (!me) return
    get().patch({
      character: me.character,
      gender: genderOf(me.character) ?? 'f',
      name: me.name,
      role: me.role,
      company: me.company ?? '',
      building: me.building ?? '',
      previously: me.previously ?? '',
      skills: (me.skills ?? []).join(', '),
      openToWork: me.open_to_work,
      portfolio: me.portfolio ?? '',
      linkedin: me.linkedin ?? '',
      x: me.x ?? '',
      location: me.location,
      spot: me.spot,
    })
  },
}))

// ---------------------------------------------------------------------------
// Input normalising — accept what people naturally paste
// ---------------------------------------------------------------------------

const INVALID = Symbol('invalid')
type Norm = string | null | typeof INVALID

export function normPortfolio(v: string): Norm {
  const t = v.trim()
  if (!t) return null
  const url = /^https?:\/\//i.test(t) ? t.replace(/^http:/i, 'https:') : `https://${t}`
  return /^https:\/\/[^\s/]+\.[^\s]+$/.test(url) && url.length <= 200 ? url : INVALID
}

export function normLinkedIn(v: string): Norm {
  const t = v.trim().replace(/\/+$/, '')
  if (!t) return null
  const m = t.match(/linkedin\.com\/(.+)$/i)
  if (m) return `https://www.linkedin.com/${m[1]}`
  if (/^[A-Za-z0-9-]{3,100}$/.test(t)) return `https://www.linkedin.com/in/${t}`
  return INVALID
}

export function normX(v: string): Norm {
  const t = v.trim().replace(/\/+$/, '')
  if (!t) return null
  const handle = t.match(/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})$/i)?.[1] ?? t.replace(/^@/, '')
  return /^[A-Za-z0-9_]{1,15}$/.test(handle) ? `https://x.com/${handle}` : INVALID
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

const short = (v: string, min: number) => v.trim().length < min

export function validateKey(key: StepKey, d: Draft): string | null {
  if (key === 'email' && !isEmail(d.email)) return 'That email doesn’t look right.'
  if (key === 'why' && short(d.appWhy, ANSWER_MIN)) return `Tell us a little more — at least ${ANSWER_MIN} characters.`
  if (key === 'want' && short(d.appWant, ANSWER_MIN)) return `Tell us a little more — at least ${ANSWER_MIN} characters.`
  if (key === 'bring' && short(d.appBring, ANSWER_MIN)) return `Tell us a little more — at least ${ANSWER_MIN} characters.`
  if (key === 'show') {
    const link = normPortfolio(d.appLink)
    if (!link) return 'Add a link to the thing you made.'
    if (link === INVALID) return 'That link doesn’t look like a URL.'
    if (short(d.appLinkWhy, LINK_WHY_MIN)) return 'Add a line on why you’re proud of it.'
  }
  return validateStep(key === 'who' ? 1 : key === 'links' ? 3 : -1, d)
}

export function validateStep(step: number, d: Draft): string | null {
  if (step === 1) {
    if (d.name.trim().length < 2) return 'Add your name so people know who you are.'
    if (d.role.trim().length < 2) return 'Add your role — e.g. Product Designer.'
  }
  if (step === 3) {
    if (normPortfolio(d.portfolio) === INVALID) return 'That portfolio link doesn’t look like a URL.'
    if (normLinkedIn(d.linkedin) === INVALID) return 'Paste your LinkedIn URL or profile handle.'
    if (normX(d.x) === INVALID) return 'X handles are letters, numbers and _ (max 15).'
  }
  return null
}

const clean = (v: Norm) => (v === INVALID ? null : v)
const opt = (v: string, max: number) => v.trim().slice(0, max) || null

export function payload(d: Draft) {
  return {
    name: d.name.trim().slice(0, 40),
    role: d.role.trim().slice(0, 60),
    company: opt(d.company, 60),
    location: d.location,
    building: opt(d.building, 80),
    previously: opt(d.previously, 80),
    open_to_work: d.openToWork,
    skills: d.skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6),
    portfolio: clean(normPortfolio(d.portfolio)),
    linkedin: clean(normLinkedIn(d.linkedin)),
    x: clean(normX(d.x)),
    character: d.character,
    spot: d.spot,
  }
}

// ---------------------------------------------------------------------------
// Auth + save
// ---------------------------------------------------------------------------

export async function sendMagicLink(email: string) {
  const ob = useOnboarding.getState()
  if (!supabase) return useOnboarding.setState({ mail: 'error', error: 'Sign-in isn’t configured yet.' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return useOnboarding.setState({ error: 'That email doesn’t look right.' })
  ob.patch({ pendingSubmit: true })
  useOnboarding.setState({ mail: 'sending', error: null })
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) useOnboarding.setState({ mail: 'error', error: error.message })
  else useOnboarding.setState({ mail: 'sent' })
}

export async function submitProfile(): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Sign-in isn’t configured yet.' }
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user) return { ok: false, error: 'Sign in first.' }
  useOnboarding.setState({ saving: true, error: null })
  const body = payload(useOnboarding.getState().draft)
  const exists = useDirectory.getState().me
  const { error } = exists
    ? await supabase.from('profiles').update(body).eq('id', user.id)
    : await supabase.from('profiles').insert({ id: user.id, ...body })
  useOnboarding.setState({ saving: false })
  if (error) {
    const msg = error.code === 'PGRST205' ? 'The profiles table isn’t set up yet.' : error.message
    useOnboarding.setState({ error: msg })
    return { ok: false, error: msg }
  }
  useOnboarding.getState().patch({ pendingSubmit: false })
  await refreshDirectory()
  return { ok: true }
}

/**
 * Invite path, after sign-in: re-check + use the code, publish the profile (approved,
 * no review) and receive your own codes — one transaction on the server.
 */
export async function redeemInvite(): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Sign-in isn’t configured yet.' }
  const d = useOnboarding.getState().draft
  if (!d.pendingInvite) return { ok: false, error: 'No invite code to use.' }
  useOnboarding.setState({ saving: true, error: null })
  // through the server, so the welcome + "they joined" emails go out (src/app/api/invite/redeem)
  const { data: session } = await supabase.auth.getSession()
  const token = session.session?.access_token
  const res = token
    ? ((await fetch('/api/invite/redeem', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: d.pendingInvite, profile: payload(d) }),
      })
        .then((r) => r.json())
        .catch(() => null)) as { ok: boolean; state?: string; message?: string; code?: string } | null)
    : { ok: false, state: 'signed_out' }
  useOnboarding.setState({ saving: false })
  if (!res?.ok) {
    const msg = !res
      ? 'Couldn’t reach the server. Check your connection and try again.'
      : res.state === 'error'
        ? res.code === 'PGRST202'
          ? 'Invites aren’t set up on the server yet.'
          : (res.message ?? 'Something went wrong.')
        : res.state === 'signed_out'
          ? 'Your sign-in expired. Open the link in your email again.'
          : res.state === 'used'
            ? 'That invite was used by someone else in the meantime.'
            : res.state === 'expired'
              ? 'That invite expired before you finished.'
              : res.state === 'own'
                ? 'You can’t use your own invite.'
                : 'That invite isn’t valid any more.'
    useOnboarding.setState({ error: msg })
    return { ok: false, error: msg }
  }
  useOnboarding.getState().patch({ pendingSubmit: false, pendingInvite: '' })
  await refreshDirectory()
  return { ok: true }
}

/**
 * Pay path, after sign-in (the magic link confirmed the email): save the profile + four
 * answers as an application. Nothing goes live and nothing is charged here (CLAUDE.md 5E-A).
 */
export async function submitApplication(): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Sign-in isn’t configured yet.' }
  const d = useOnboarding.getState().draft
  useOnboarding.setState({ saving: true, error: null })
  const answers = {
    why: d.appWhy.trim().slice(0, ANSWER_MAX),
    want: d.appWant.trim().slice(0, ANSWER_MAX),
    bring: d.appBring.trim().slice(0, ANSWER_MAX),
    show_link: clean(normPortfolio(d.appLink)),
    show_why: d.appLinkWhy.trim().slice(0, LINK_WHY_MAX),
  }
  const { data, error } = await supabase.rpc('submit_application', { p_answers: answers, p_profile: payload(d) })
  useOnboarding.setState({ saving: false })
  const res = data as { ok: boolean; state?: string } | null
  if (error || !res?.ok) {
    const msg = error
      ? error.code === 'PGRST202'
        ? 'Applications aren’t set up on the server yet.'
        : error.message
      : res?.state === 'member'
        ? 'You’re already in the city.'
        : res?.state === 'in_review'
          ? 'Your application is already being reviewed.'
          : res?.state === 'signed_out'
            ? 'Sign in first.'
            : 'Some answers are too short or too long. Check them and try again.'
    useOnboarding.setState({ error: msg })
    return { ok: false, error: msg }
  }
  useOnboarding.getState().patch({ pendingSubmit: false, pendingApply: false })
  return { ok: true }
}

export async function signOut() {
  await supabase?.auth.signOut()
  await refreshDirectory()
}
