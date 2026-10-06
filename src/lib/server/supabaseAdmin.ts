import 'server-only'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

// Server-only Supabase client with the SECRET key: bypasses row-level security.
// Used by the payment + review routes (CLAUDE.md 5E-B) to write states the client never may.

let client: SupabaseClient | null = null

export function admin(): SupabaseClient {
  if (client) return client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY not set')
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return client
}

/** The signed-in caller, from `Authorization: Bearer <supabase access token>`. */
export async function userFrom(req: Request): Promise<User | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await admin().auth.getUser(token)
  return error ? null : data.user
}

export async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await admin().from('admins').select('user_id').eq('user_id', userId).maybeSingle()
  return !!data
}

export async function setting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await admin().from('app_settings').select('value').eq('key', key).maybeSingle()
  return (data?.value as T | undefined) ?? fallback
}

export type ApplicationRow = {
  id: string
  user_id: string
  email: string
  why: string
  want: string
  bring: string
  show_link: string
  show_why: string
  profile: Record<string, unknown>
  status: 'draft' | 'submitted' | 'paid' | 'under_review' | 'approved' | 'rejected' | 'refunded' | 'refund_failed'
  payment_id: string | null
  checkout_id: string | null
  refund_id: string | null
  amount: number | null
  currency: string | null
  reviewer: string | null
  reason: string | null
  paid_at: string | null
  decided_at: string | null
  created_at: string
}

export const json = (body: unknown, status = 200) => Response.json(body, { status })
