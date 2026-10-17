import { useEffect, useState } from 'react'
import { CODE_MAX, CODE_MIN, RESEND_AFTER_MS, cleanCode, verifyEmailCode } from '@/lib/otp'

const WRONG = 'That code didn’t work. Check the newest email from us, or send a new code.'
const ERROR = 'Couldn’t check the code right now. Check your connection and try again.'

/**
 * "Type the code we emailed you": every sign-in in the game (and the admin page) ends here.
 * Checking the code signs this tab in; whatever was waiting on the sign-in carries on from SIGNED_IN.
 */
export function CodeEntry({
  email,
  onResend,
  onVerified,
  className = '',
}: {
  email: string
  /** sends a fresh code (the same call that sent the first one) */
  onResend: () => Promise<unknown> | unknown
  onVerified?: () => void
  className?: string
}) {
  const [code, setCode] = useState('')
  const [state, setState] = useState<'idle' | 'checking' | 'wrong' | 'error' | 'ok'>('idle')
  const [sentAt, setSentAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const wait = Math.max(0, Math.ceil((sentAt + RESEND_AFTER_MS - now) / 1000))

  useEffect(() => {
    if (wait <= 0) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [wait])

  const check = async () => {
    if (state === 'checking' || state === 'ok' || code.length < CODE_MIN) return
    setState('checking')
    const r = await verifyEmailCode(email, code)
    if (r === 'ok') {
      setState('ok')
      onVerified?.()
    } else setState(r)
  }

  const resend = async () => {
    if (wait > 0) return
    setCode('')
    setState('idle')
    setSentAt(Date.now())
    setNow(Date.now())
    await onResend()
  }

  return (
    <div className={`code-entry ${className}`}>
      <p className="cr-copy">
        We emailed a code to <b>{email.trim()}</b>. Type it here. It works once, and only for a while.
      </p>
      <div className="cr-email code-row">
        <input
          className="code-input"
          value={code}
          onChange={(e) => {
            setCode(cleanCode(e.target.value))
            if (state === 'wrong' || state === 'error') setState('idle')
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            // the panel's own Enter (next step, send again) must not fire as well
            e.preventDefault()
            e.nativeEvent.stopPropagation()
            if (!e.repeat) void check()
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={CODE_MAX}
          placeholder="CODE"
          autoFocus
          spellCheck={false}
          aria-label="Code from the email"
        />
        <button className="btn-primary slant" onClick={() => void check()} disabled={code.length < CODE_MIN || state === 'checking' || state === 'ok'}>
          <span className="unslant">{state === 'checking' ? 'CHECKING…' : state === 'ok' ? 'SIGNED IN ✓' : 'SIGN IN ▸'}</span>
        </button>
      </div>
      {(state === 'wrong' || state === 'error') && <div className="cr-error">{state === 'wrong' ? WRONG : ERROR}</div>}
      <p className="code-resend">
        No email? Check spam, or{' '}
        <button className="gate-switch" onClick={() => void resend()} disabled={wait > 0}>
          {wait > 0 ? `SEND A NEW CODE IN ${wait}s` : 'SEND A NEW CODE ▸'}
        </button>
      </p>
    </div>
  )
}
