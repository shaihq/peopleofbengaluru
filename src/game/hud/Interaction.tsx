'use client'

import { useEffect } from 'react'
import { getCharacter } from '../characters/roster'
import type { Profile } from '../people/profiles'
import { getPeople } from '../people/directory'
import { useGame } from '../store'
import { activeStatus } from '../status'
import { isTyping } from '../player/input'
import { ConnectBlock } from './Connections'

const byId = (id: string | null) => (id ? getPeople().find((p) => p.id === id) : undefined)

/**
 * Approach prompt: just the action. Who they are (name, role, open to work, status) is
 * already on their nameplate right above them, and the ring on the ground marks who it's for.
 */
function Prompt({ p, onOpen }: { p: Profile; onOpen: () => void }) {
  return (
    <button className="prompt prompt--person slant" key={p.id} onClick={onOpen} aria-label={`View ${p.name}'s profile`}>
      <span className="unslant prompt-body">
        <span className="prompt-action">
          <span className="keycap">E</span> VIEW PROFILE
        </span>
      </span>
    </button>
  )
}

/** Standing at the portal: choose when to travel (never pops up on its own). */
function PortalPrompt({ onOpen }: { onOpen: () => void }) {
  return (
    <button className="prompt prompt--portal slant" onClick={onOpen}>
      <span className="unslant prompt-body">
        <span className="prompt-open">
          <span className="warp-ring" /> PORTAL · ಪ್ರಯಾಣ
        </span>
        <span className="prompt-name">TRAVEL</span>
        <span className="prompt-role">Step through to another district</span>
        <span className="prompt-action">
          <span className="keycap">E</span> CHOOSE DESTINATION
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
          {p.sample && <span className="pp-sample">SAMPLE</span>}
          <button className="pp-close" onClick={onClose} aria-label="Close profile">
            <span className="keycap">ESC</span>
          </button>
        </div>

        <h2 className="pp-name">{p.name}</h2>
        <div className="pp-role">
          {p.role}
          {p.company && (
            <>
              {' '}
              <span>·</span> {p.company}
            </>
          )}
        </div>
        <div className="pp-loc">
          <span className="pp-pin" /> {p.location}, Bengaluru
        </div>

        {activeStatus(p.status) && (
          <div className="pp-note">
            {p.status!.emoji && <span className="pp-note-e">{p.status!.emoji}</span>}
            <span className="pp-note-body">
              <span className="pp-note-k">STATUS</span>
              <span className="pp-note-t">{p.status!.text}</span>
            </span>
          </div>
        )}

        {p.openToWork && (
          <div className="pp-status slant pp-status--open">
            <span className="unslant">
              <span className="np-dot" /> OPEN TO WORK
            </span>
          </div>
        )}

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
          <ConnectBlock p={p} />
          <LinkButton label="PORTFOLIO" href={p.links.portfolio} />
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
  const portalPrompt = useGame(
    (s) => s.nearPortal && !s.focusId && !s.openId && !s.searchOpen && !s.statusOpen && !s.connectOpen && !s.paused && !s.portalOpen && !s.travel && s.trackStage !== 'fly' && s.trackStage !== 'hold',
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = useGame.getState()
      if (g.phase !== 'play' || isTyping(e) || g.searchOpen || g.statusOpen || g.connectOpen || g.paused || g.portalOpen || g.travel) return
      if (e.code === 'KeyE' && !e.repeat) {
        if (g.openId) g.closeProfile()
        else if (g.focusId) g.openProfile(g.focusId)
        else if (g.nearPortal && g.trackStage !== 'fly' && g.trackStage !== 'hold') g.setPortalOpen(true)
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
      {portalPrompt && <PortalPrompt onOpen={() => useGame.getState().setPortalOpen(true)} />}
      {open && <Panel p={open} onClose={closeProfile} />}
    </>
  )
}
