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
  created_at: string
}
