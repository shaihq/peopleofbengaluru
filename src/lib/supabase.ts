import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_PUBLISHABLE_KEY

/** Browser client (publishable key — safe to ship; row-level security does the guarding). Null if not configured. */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
      })
    : null

export type ProfileRow = {
  id: string
  name: string
  role: string
  company: string | null
  location: string
  building: string | null
  previously: string | null
  open_to_work: boolean
  skills: string[]
  portfolio: string | null
  linkedin: string | null
  x: string | null
  character: string
  spot: string
  status: 'pending' | 'approved' | 'hidden' | 'rejected'
  /** Their status above the nameplate (Phase 5F-B; supabase/migrations/0005_status.sql). */
  note_text?: string | null
  note_emoji?: string | null
  note_expires_at?: string | null
  created_at: string
}
