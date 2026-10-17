import { supabase } from './supabase'

// Email sign-in by one-time code (no links): Supabase emails a code through the Confirm signup
// template (first sign-in of a new or unconfirmed account) or the Magic Link template (everyone else);
// both show {{ .Token }}. Checking it here signs this tab in (onAuthStateChange → SIGNED_IN).

/** Supabase → Auth → Email OTP Length. Codes are digits; the box accepts 6–10. */
export const CODE_MIN = 6
export const CODE_MAX = 10
/** Supabase refuses a new code for the same email within ~60 s. */
export const RESEND_AFTER_MS = 60_000

export type VerifyResult = 'ok' | 'wrong' | 'error'

export const cleanCode = (raw: string) => raw.replace(/\D/g, '').slice(0, CODE_MAX)

export async function verifyEmailCode(email: string, code: string): Promise<VerifyResult> {
  if (!supabase) return 'error'
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: cleanCode(code), type: 'email' })
  if (!error) return 'ok'
  // wrong, already used or expired all come back as one error: "Token has expired or is invalid"
  if (error.status === 403 || error.code === 'otp_expired' || /expired|invalid/i.test(error.message)) return 'wrong'
  return 'error'
}
