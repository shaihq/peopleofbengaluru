import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { DEFAULT_CHARACTER } from './characters/roster'
import { refreshDirectory, useDirectory } from './people/directory'
import type { SpotId } from './people/spots'

// "Become visible" — character-creation style onboarding (CLAUDE.md §1).
// The draft lives in localStorage so the magic-link round trip never loses it.

export type Draft = {
  character: string
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
  spot: SpotId
  /** Set when we're waiting on a magic link — submit as soon as the session arrives. */
  pendingSubmit: boolean
}

export const STEPS = ['PICK YOUR LOOK', 'WHO ARE YOU?', 'WHAT ARE YOU BUILDING?', 'WHERE CAN PEOPLE FIND YOU?', 'WHERE DO YOU HANG OUT?', 'GO LIVE'] as const

const KEY = 'dob.draft'

const EMPTY: Draft = {
  character: DEFAULT_CHARACTER,
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
      spot: me.spot as SpotId,
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

function payload(d: Draft) {
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

export async function signOut() {
  await supabase?.auth.signOut()
  await refreshDirectory()
}
