'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getCharacter } from '../characters/roster'
import { bodies, player } from '../people/bodies'
import { usePeople } from '../people/directory'
import { look, isTyping } from '../player/input'
import { CATEGORIES, searchPeople, whereIs, type Category } from '../search'
import { useGame } from '../store'

const EXAMPLES = ['design engineer', 'open to work', 'Indiranagar', 'design systems', 'founder']

/** Plain-language direction from you, relative to where the camera faces. */
function direction(x: number, z: number, dist: number) {
  const p = player.pos
  if (!p) return ''
  if (dist < 4) return 'RIGHT HERE'
  const a = Math.atan2(x - p.x, z - p.z)
  const fwd = Math.atan2(-Math.sin(look.yaw), -Math.cos(look.yaw))
  let rel = a - fwd
  while (rel > Math.PI) rel -= Math.PI * 2
  while (rel < -Math.PI) rel += Math.PI * 2
  const side = rel < 0 ? 'RIGHT' : 'LEFT'
  const r = Math.abs(rel)
  if (r < Math.PI / 8) return 'AHEAD'
  if (r < (3 * Math.PI) / 8) return `AHEAD ${side}`
  if (r < (5 * Math.PI) / 8) return `TO YOUR ${side}`
  if (r < (7 * Math.PI) / 8) return `BEHIND ${side}`
  return 'BEHIND YOU'
}

/** Ink text on light accents, cream on dark ones. */
function badgeInk(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.5 ? '#1C1F2B' : '#FFF6E5'
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)

/** "Find someone in the city" — search as a game mechanic (CLAUDE.md §14). */
export function Search() {
  const phase = useGame((s) => s.phase)
  const open = useGame((s) => s.searchOpen)
  const setSearch = useGame((s) => s.setSearch)
  const track = useGame((s) => s.track)
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<Category>('all')
  const [sel, setSel] = useState(0)
  const [tick, setTick] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const people = usePeople()
  const list = useRef<HTMLDivElement>(null)

  // F opens, Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = useGame.getState()
      if (g.phase !== 'play') return
      if (!g.searchOpen && !g.openId && e.code === 'KeyF' && !isTyping(e)) {
        e.preventDefault()
        setSearch(true)
      } else if (g.searchOpen && e.code === 'Escape') setSearch(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSearch])

  // live distances while open
  useEffect(() => {
    if (!open) return
    setSel(0)
    const id = setInterval(() => setTick((t) => t + 1), 500)
    requestAnimationFrame(() => input.current?.focus())
    return () => clearInterval(id)
  }, [open])

  const rows = useMemo(() => {
    if (!open) return []
    const me = player.pos
    return searchPeople(query, cat, (id) => bodies.get(id))
      .map(({ p, score }) => {
        const pos = bodies.get(p.id)
        const dist = pos && me ? Math.hypot(pos.x - me.x, pos.z - me.z) : Infinity
        return { p, score, pos, dist }
      })
      .sort((a, b) => (query.trim() ? b.score - a.score || a.dist - b.dist : a.dist - b.dist))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, cat, tick])

  useEffect(() => {
    list.current?.querySelector('.find-row--sel')?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  if (phase !== 'play' || !open) return null

  const choose = (id: string) => track(id)
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => Math.min(rows.length - 1, s + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => Math.max(0, s - 1))
    } else if (e.key === 'Enter' && rows[sel]) choose(rows[sel].p.id)
  }

  return (
    <div className="find" onMouseDown={(e) => e.target === e.currentTarget && setSearch(false)}>
      <div className="find-card">
        <header className="find-bar">
          <span className="find-tag">
            <span className="find-glass" /> FIND SOMEONE IN THE CITY
          </span>
          <span className="find-count">{people.length} PEOPLE IN 5TH BLOCK</span>
          <button className="find-esc" onClick={() => setSearch(false)} aria-label="Close search">
            <span className="keycap">ESC</span>
          </button>
        </header>

        <div className="find-body">
          <div className="find-input">
            <input
              ref={input}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSel(0)
              }}
              onKeyDown={onKeyDown}
              placeholder="Name, role, company, skill, project, area…"
              spellCheck={false}
              aria-label="Search people"
            />
            {query && (
              <button className="find-clear" onClick={() => (setQuery(''), input.current?.focus())} aria-label="Clear search">
                CLEAR
              </button>
            )}
          </div>

          <div className="find-chips">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                className={`chip slant${cat === c.id ? ' chip--on' : ''}`}
                onClick={() => {
                  setCat(c.id)
                  setSel(0)
                  input.current?.focus()
                }}
              >
                <span className="unslant chip-name">{c.label}</span>
              </button>
            ))}
          </div>

          <div className="find-label">
            {query.trim() ? 'BEST MATCHES' : 'NEAREST FIRST'} <span>· {rows.length}</span>
          </div>

          <div className="find-results" ref={list}>
            {rows.length === 0 && (
              <div className="find-empty">
                <strong>Nobody here matches that yet.</strong>
                <span>
                  Try{' '}
                  {EXAMPLES.map((ex) => (
                    <button key={ex} onClick={() => (setQuery(ex), input.current?.focus())}>
                      {ex}
                    </button>
                  ))}
                </span>
              </div>
            )}
            {rows.map(({ p, pos, dist }, i) => {
              const style = getCharacter(p.character)
              const on = i === sel
              return (
                <button
                  key={p.id}
                  className={`find-row${on ? ' find-row--sel' : ''}`}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => choose(p.id)}
                  style={{ ['--accent' as string]: style.accent, ['--badge-ink' as string]: badgeInk(style.accent) }}
                >
                  <span className="find-badge">{initials(p.name)}</span>
                  <span className="find-who">
                    <span className="find-name">
                      {p.name}
                      {p.openToWork && (
                        <span className="find-open">
                          <span className="np-dot" /> OPEN TO WORK
                        </span>
                      )}
                    </span>
                    <span className="find-role">
                      {p.role}
                      {p.company ? ` · ${p.company}` : ''}
                    </span>
                  </span>
                  <span className="find-where">
                    <span className="find-place">{pos ? whereIs(pos.x, pos.z) : '—'}</span>
                    {pos && Number.isFinite(dist) && (
                      <span className="find-dir">
                        <b>{Math.round(dist)}m</b> · {direction(pos.x, pos.z, dist)}
                      </span>
                    )}
                  </span>
                  <span className="find-go">GO ▸</span>
                </button>
              )
            })}
          </div>
        </div>

        <footer className="find-foot">
          <span>
            <span className="keycap">↑</span>
            <span className="keycap">↓</span> CHOOSE
          </span>
          <span>
            <span className="keycap keycap--wide">ENTER</span> TAKE ME THERE
          </span>
          <span>
            <span className="keycap keycap--wide">ESC</span> BACK TO THE CITY
          </span>
        </footer>
      </div>
    </div>
  )
}
