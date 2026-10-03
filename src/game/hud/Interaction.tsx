'use client'

import { useEffect } from 'react'
import { getCharacter } from '../characters/roster'
import { PEOPLE, type Profile } from '../people/profiles'
import { useGame } from '../store'
import { isTyping } from '../player/input'

const byId = (id: string | null) => (id ? PEOPLE.find((p) => p.id === id) : undefined)

/** Approach prompt (CLAUDE.md §12): who they are + [E] VIEW PROFILE. */
function Prompt({ p, onOpen }: { p: Profile; onOpen: () => void }) {
  return (
    <button className="prompt slant" key={p.id} onClick={onOpen}>
      <span className="unslant prompt-body">
        {p.openToWork && (
          <span className="prompt-open">
            <span className="np-dot" /> OPEN TO WORK
          </span>
        )}
        <span className="prompt-name">{p.name}</span>
        <span className="prompt-role">
          {p.role} · {p.company}
        </span>
        <span className="prompt-action">
          <span className="keycap">E</span> VIEW PROFILE
        </span>
      </span>
    </button>
  )
}

function LinkButton({ label, href, primary }: { label: string; href?: string; primary?: boolean }) {
  const cls = `pp-btn slant${primary ? ' pp-btn--primary' : ''}${href ? '' : ' pp-btn--off'}`
  if (!href)
    return (
      <span className={cls} title="Not added yet">
        <span className="unslant">
          {label} <small>NOT ADDED YET</small>
        </span>
      </span>
    )
  return (
    <a className={cls} href={href} target="_blank" rel="noopener noreferrer">
      <span className="unslant">{label} ↗</span>
    </a>
  )
}

/** Profile panel (CLAUDE.md §13) — slides in from the right; the world stays visible. */
function Panel({ p, onClose }: { p: Profile; onClose: () => void }) {
  const style = getCharacter(p.character)
  return (
    <aside className="pp" key={p.id} style={{ ['--accent' as string]: style.accent }}>
      <div className="pp-inner">
        <div className="pp-top">
          <span className="pp-tag">PROFILE</span>
          <span className="pp-sample">SAMPLE</span>
          <button className="pp-close" onClick={onClose} aria-label="Close profile">
            <span className="keycap">ESC</span>
          </button>
        </div>

        <h2 className="pp-name">{p.name}</h2>
        <div className="pp-role">
          {p.role} <span>·</span> {p.company}
        </div>
        <div className="pp-loc">
          <span className="pp-pin" /> {p.location}, Bengaluru
        </div>

        <div className={`pp-status slant${p.openToWork ? ' pp-status--open' : ''}`}>
          <span className="unslant">
            {p.openToWork ? (
              <>
                <span className="np-dot" /> OPEN TO WORK
              </>
            ) : (
              'NOT LOOKING RIGHT NOW'
            )}
          </span>
        </div>

        {p.building && (
          <section className="pp-section">
            <h3>CURRENTLY BUILDING</h3>
            <p>{p.building}</p>
          </section>
        )}
        {p.previously && (
          <section className="pp-section">
            <h3>PREVIOUSLY</h3>
            <p>{p.previously}</p>
          </section>
        )}
        <section className="pp-section">
          <h3>PLAYS AS</h3>
          <p>
            <span className="pp-swatch" /> {style.name}
          </p>
        </section>

        <div className="pp-links">
          <LinkButton label="PORTFOLIO" href={p.links.portfolio} primary />
          <div className="pp-links-row">
            <LinkButton label="LINKEDIN" href={p.links.linkedin} />
            <LinkButton label="X" href={p.links.x} />
          </div>
        </div>
      </div>
    </aside>
  )
}

export function Interaction() {
  const phase = useGame((s) => s.phase)
  const focusId = useGame((s) => s.focusId)
  const openId = useGame((s) => s.openId)
  const openProfile = useGame((s) => s.openProfile)
  const closeProfile = useGame((s) => s.closeProfile)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = useGame.getState()
      if (g.phase !== 'play' || isTyping(e) || g.searchOpen) return
      if (e.code === 'KeyE') {
        if (g.openId) g.closeProfile()
        else if (g.focusId) g.openProfile(g.focusId)
      }
      if (e.code === 'Escape' && g.openId) g.closeProfile()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (phase !== 'play') return null
  const open = byId(openId)
  const focus = byId(focusId)
  return (
    <>
      {focus && !open && <Prompt p={focus} onOpen={() => openProfile(focus.id)} />}
      {open && <Panel p={open} onClose={closeProfile} />}
    </>
  )
}
