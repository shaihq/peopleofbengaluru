import { useEffect, useRef, useState } from 'react'
import { CODE_LENGTH, RESEND_AFTER_MS, cleanCode, verifyEmailCode } from '@/lib/otp'

const WRONG = 'That code didn’t work. Check the newest email from us, or send a new code.'
const ERROR = 'Couldn’t check the code right now. Check your connection and try again.'

type State = 'idle' | 'checking' | 'wrong' | 'error' | 'ok'

/**
 * "Type the code we emailed you": every sign-in in the game (and the admin page) ends here.
 * Six slanted tiles over one real input (so paste, the keyboard's "from Mail" suggestion and
 * screen readers all just work). The sixth digit checks the code; signing in carries on from SIGNED_IN.
 */
export function CodeEntry({
  email,
  onResend,
  onVerified,
}: {
  email: string
  /** sends a fresh code (the same call that sent the first one) */
  onResend: () => Promise<unknown> | unknown
  onVerified?: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState('')
  const [state, setState] = useState<State>('idle')
  const [focused, setFocused] = useState(true)
  const [shake, setShake] = useState(0)
  const [sentAt, setSentAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const wait = Math.max(0, Math.ceil((sentAt + RESEND_AFTER_MS - now) / 1000))
  const busy = state === 'checking' || state === 'ok'

  useEffect(() => {
    if (wait <= 0) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [wait])

  const check = async (value: string) => {
    if (busy || value.length < CODE_LENGTH) return
    setState('checking')
    const r = await verifyEmailCode(email, value)
    if (r === 'ok') {
      setState('ok')
      input.current?.blur()
      onVerified?.()
      return
    }
    setState(r)
    setShake((n) => n + 1)
    if (r === 'wrong') setCode('')
    input.current?.focus()
  }

  const change = (raw: string) => {
    if (busy) return
    const v = cleanCode(raw)
    setCode(v)
    if (state === 'wrong' || state === 'error') setState('idle')
    if (v.length === CODE_LENGTH) void check(v)
  }

  const resend = async () => {
    if (wait > 0) return
    setCode('')
    setState('idle')
    setSentAt(Date.now())
    setNow(Date.now())
    input.current?.focus()
    await onResend()
  }

  const active = focused && !busy ? Math.min(code.length, CODE_LENGTH - 1) : -1

  return (
    <div className="code-entry">
      <p className="cr-copy">
        We emailed a {CODE_LENGTH}-digit code to <b>{email.trim()}</b>.
      </p>
      <div
        // two identical shakes, alternated, so every wrong code replays it
        className={`code-tiles code-tiles--${state}${shake ? ` code-tiles--shake${shake % 2}` : ''}`}
        onMouseDown={(e) => {
          // a tap anywhere on the tiles types into the one real input
          e.preventDefault()
          input.current?.focus()
        }}
      >
        {Array.from({ length: CODE_LENGTH }, (_, i) => (
          <span
            key={i}
            className={`code-tile slant${code[i] ? ' code-tile--full' : ''}${i === active ? ' code-tile--on' : ''}`}
            style={{ ['--i' as string]: i }}
          >
            <span className="unslant">{code[i] ?? ''}</span>
          </span>
        ))}
        <input
          ref={input}
          className="code-real"
          value={code}
          onChange={(e) => change(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            // the panel's own Enter (next step, send again) must not fire as well
            e.preventDefault()
            e.nativeEvent.stopPropagation()
            if (!e.repeat) void check(code)
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={CODE_LENGTH}
          autoFocus
          spellCheck={false}
          disabled={busy}
          aria-label={`${CODE_LENGTH}-digit code from the email`}
        />
      </div>
      <p className={`code-status code-status--${state}`} role="status" aria-live="polite">
        {state === 'checking'
          ? 'CHECKING…'
          : state === 'ok'
            ? '✓ SIGNED IN'
            : state === 'wrong'
              ? WRONG
              : state === 'error'
                ? ERROR
                : 'It works once, for one hour.'}
      </p>
      <p className="code-resend">
        No email? Check spam, or{' '}
        <button className="gate-switch" onClick={() => void resend()} disabled={wait > 0 || busy}>
          {wait > 0 ? `SEND A NEW CODE IN ${wait}s` : 'SEND A NEW CODE ▸'}
        </button>
      </p>
    </div>
  )
}
