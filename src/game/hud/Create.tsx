'use client'

import { useEffect, useRef, useState } from 'react'
import { PLAYABLE, getCharacter } from '../characters/roster'
import { useDirectory } from '../people/directory'
import { NEIGHBOURHOODS, SPOTS, SPOT_IDS } from '../people/spots'
import { STEPS, sendMagicLink, submitProfile, useOnboarding, validateStep, type Draft } from '../onboarding'
import { requestLook } from '../player/input'
import { useGame } from '../store'

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  max,
  autoFocus,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  max: number
  autoFocus?: boolean
}) {
  return (
    <label className="cr-field">
      <span className="cr-label">
        {label} {hint && <em>{hint}</em>}
      </span>
      <input
        value={value}
        maxLength={max}
        placeholder={placeholder}
        autoFocus={autoFocus}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

function LookStep({ d, patch }: { d: Draft; patch: (p: Partial<Draft>) => void }) {
  const i = Math.max(0, PLAYABLE.findIndex((c) => c.id === d.character))
  const def = getCharacter(d.character)
  const step = (n: number) => patch({ character: PLAYABLE[(i + n + PLAYABLE.length) % PLAYABLE.length].id })
  return (
    <>
      <div className="cr-look">
        <div className="select-count">
          {String(i + 1).padStart(2, '0')} / {String(PLAYABLE.length).padStart(2, '0')}
        </div>
        <h3 key={def.id}>{def.name}</h3>
        <p>{def.tagline}</p>
        <div className="select-arrows">
          <button className="arrow slant" onClick={() => step(-1)} aria-label="Previous look">
            <span className="unslant">◀</span>
          </button>
          <button className="arrow slant" onClick={() => step(1)} aria-label="Next look">
            <span className="unslant">▶</span>
          </button>
        </div>
      </div>
      <div className="cr-chips">
        {PLAYABLE.map((c) => (
          <button
            key={c.id}
            className={`chip slant${c.id === d.character ? ' chip--on' : ''}`}
            onClick={() => patch({ character: c.id })}
            aria-label={c.name}
          >
            <span className="chip-swatch" style={{ background: c.accent }} />
            <span className="unslant chip-name">{c.name.replace('THE ', '')}</span>
          </button>
        ))}
      </div>
    </>
  )
}

function GoLiveStep({ d }: { d: Draft }) {
  const userId = useDirectory((s) => s.userId)
  const email = useDirectory((s) => s.email)
  const me = useDirectory((s) => s.me)
  const mail = useOnboarding((s) => s.mail)
  const saving = useOnboarding((s) => s.saving)
  const [addr, setAddr] = useState('')
  const enter = useGame((s) => s.endCreate)
  const showToast = useGame((s) => s.showToast)

  const goLive = async () => {
    const r = await submitProfile()
    if (!r.ok) return
    enter()
    showToast(me?.status === 'approved' ? 'PROFILE UPDATED' : 'YOU’RE VISIBLE · LIVE FOR EVERYONE ONCE APPROVED', 'good')
  }

  return (
    <div className="cr-live">
      <div className="cr-summary">
        <span className="cr-summary-k">YOU’LL HANG OUT AT</span>
        <span className="cr-summary-v">{SPOTS[d.spot].label}</span>
        <span className="cr-summary-k">FROM</span>
        <span className="cr-summary-v">{d.location}, Bengaluru</span>
      </div>

      {userId ? (
        <>
          <p className="cr-copy">
            Signed in as <b>{email}</b>.{' '}
            {me?.status === 'approved'
              ? 'Your changes go live right away.'
              : 'You’ll see yourself straight away; everyone else sees you once your profile is approved.'}
          </p>
          <button className="btn-primary slant cr-golive" onClick={goLive} disabled={saving}>
            <span className="unslant">{saving ? 'SAVING…' : me ? 'SAVE CHANGES ▸' : 'GO LIVE ▸'}</span>
          </button>
        </>
      ) : mail === 'sent' ? (
        <div className="cr-sent">
          <b>CHECK YOUR INBOX</b>
          <p>
            We sent a sign-in link to <b>{addr}</b>. Tap it on this device and you’ll land back here — visible.
          </p>
        </div>
      ) : (
        <>
          <p className="cr-copy">Save your profile with a one-tap email link. No passwords.</p>
          <div className="cr-email">
            <input
              type="email"
              value={addr}
              placeholder="you@studio.com"
              autoFocus
              onChange={(e) => setAddr(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMagicLink(addr)}
              aria-label="Email"
            />
            <button className="btn-primary slant" onClick={() => sendMagicLink(addr)} disabled={mail === 'sending'}>
              <span className="unslant">{mail === 'sending' ? 'SENDING…' : 'SEND MY LINK ▸'}</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/** "Become visible" — character creation + profile, over the live street. */
export function Create() {
  const phase = useGame((s) => s.phase)
  const endCreate = useGame((s) => s.endCreate)
  const { step, draft: d, error, setStep, patch } = useOnboarding()
  const panel = useRef<HTMLDivElement>(null)
  const last = STEPS.length - 1

  const next = () => {
    const err = validateStep(step, d)
    if (err) return useOnboarding.setState({ error: err })
    setStep(Math.min(last, step + 1))
  }
  const back = () => (step === 0 ? exit() : setStep(step - 1))
  const exit = () => {
    endCreate()
    requestLook()
  }

  useEffect(() => {
    if (phase !== 'create') return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') exit()
      if (e.code === 'Enter' && step < last && (e.target as HTMLElement).tagName !== 'BUTTON') next()
      if (step === 0 && (e.target as HTMLElement).tagName !== 'INPUT') {
        const i = PLAYABLE.findIndex((c) => c.id === d.character)
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') patch({ character: PLAYABLE[(i - 1 + PLAYABLE.length) % PLAYABLE.length].id })
        if (e.code === 'ArrowRight' || e.code === 'KeyD') patch({ character: PLAYABLE[(i + 1) % PLAYABLE.length].id })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    panel.current?.querySelector<HTMLInputElement>('input')?.focus()
  }, [step])

  if (phase !== 'create') return null

  return (
    <div className="cr">
      <div className="select-shade" />
      <div className="cr-panel" ref={panel} key={step}>
        <div className="cr-top">
          <span className="cr-tag slant">
            <span className="unslant">BECOME VISIBLE</span>
          </span>
          <span className="cr-step">
            STEP {step + 1} / {STEPS.length}
          </span>
          <span className="cr-pips">
            {STEPS.map((_, i) => (
              <span key={i} className={i <= step ? 'on' : ''} />
            ))}
          </span>
        </div>
        <h2 className="cr-title">{STEPS[step]}</h2>

        {step === 0 && <LookStep d={d} patch={patch} />}

        {step === 1 && (
          <div className="cr-fields">
            <Field label="NAME" value={d.name} onChange={(name) => patch({ name })} placeholder="Ananya Rao" max={40} />
            <Field label="ROLE" value={d.role} onChange={(role) => patch({ role })} placeholder="Product Designer" max={60} />
            <Field label="COMPANY" hint="optional" value={d.company} onChange={(company) => patch({ company })} placeholder="Where you work" max={60} />
          </div>
        )}

        {step === 2 && (
          <div className="cr-fields">
            <Field label="CURRENTLY BUILDING" hint="optional" value={d.building} onChange={(building) => patch({ building })} placeholder="A side project, a startup, a design system…" max={80} />
            <Field label="PREVIOUSLY" hint="optional" value={d.previously} onChange={(previously) => patch({ previously })} placeholder="Past teams or studios" max={80} />
            <Field label="SKILLS" hint="comma separated" value={d.skills} onChange={(skills) => patch({ skills })} placeholder="Figma, Motion, Design systems" max={120} />
            <button className={`cr-toggle${d.openToWork ? ' cr-toggle--on' : ''}`} onClick={() => patch({ openToWork: !d.openToWork })}>
              <span className="cr-switch" />
              <span>
                <b>OPEN TO WORK</b>
                <em>Shows a green tag on your nameplate</em>
              </span>
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="cr-fields">
            <Field label="PORTFOLIO" hint="optional" value={d.portfolio} onChange={(portfolio) => patch({ portfolio })} placeholder="yourname.design" max={200} />
            <Field label="LINKEDIN" hint="optional" value={d.linkedin} onChange={(linkedin) => patch({ linkedin })} placeholder="linkedin.com/in/you" max={200} />
            <Field label="X" hint="optional" value={d.x} onChange={(x) => patch({ x })} placeholder="@handle" max={60} />
          </div>
        )}

        {step === 4 && (
          <div className="cr-fields">
            <span className="cr-label">YOUR NEIGHBOURHOOD</span>
            <div className="cr-chips cr-chips--tight">
              {NEIGHBOURHOODS.map((n) => (
                <button key={n} className={`chip slant${d.location === n ? ' chip--on' : ''}`} onClick={() => patch({ location: n })}>
                  <span className="unslant chip-name">{n.toUpperCase()}</span>
                </button>
              ))}
            </div>
            <span className="cr-label" style={{ marginTop: 18 }}>
              WHERE YOU’LL BE FOUND IN 5TH BLOCK
            </span>
            <div className="cr-spots">
              {SPOT_IDS.map((id) => (
                <button key={id} className={`cr-spot${d.spot === id ? ' cr-spot--on' : ''}`} onClick={() => patch({ spot: id })}>
                  <b>{SPOTS[id].label}</b>
                  <em>{SPOTS[id].blurb}</em>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 5 && <GoLiveStep d={d} />}

        {error && <div className="cr-error">{error}</div>}

        <div className="cr-nav">
          <button className="pp-btn slant cr-back" onClick={back}>
            <span className="unslant">{step === 0 ? 'NOT NOW' : '◀ BACK'}</span>
          </button>
          {step < last && (
            <button className="btn-primary slant cr-next" onClick={next}>
              <span className="unslant">NEXT ▸</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
