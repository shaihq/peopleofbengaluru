'use client'

import { useEffect } from 'react'
import { MISSIONS, allDone, currentMission, type MissionId } from '../missions'
import { PREVIEW, useMissions } from '../missionsStore'
import { getPeople, useDirectory } from '../people/directory'
import { bodies, player } from '../people/bodies'
import { activeStatus } from '../status'
import { isTyping } from '../player/input'
import { useGame } from '../store'

// DAY ZERO — the mission tracker, top-left under the location badge (CLAUDE.md "Day Zero missions").
// design.md §10: a slanted ink panel; the current mission in saffron with its hint, done ones in green.

/** Each line does its mission's first step. */
function go(id: MissionId) {
  const g = useGame.getState()
  if (PREVIEW) return useMissions.getState().complete(id)
  if (id === 'note') return g.setStatusOpen(true)
  if (id === 'invite') return g.setInvitesOpen(true)
  if (id === 'cross') {
    g.setPortalFor(null)
    return g.track('portal')
  }
  // the nearest real member here with a note up; nobody → the finder
  const me = useDirectory.getState().me?.id
  const at = player.pos
  let best: string | null = null
  let bestD = Infinity
  for (const p of getPeople()) {
    const b = bodies.get(p.id)
    if (p.sample || p.id === me || !b || !activeStatus(p.status)) continue
    const d = at ? Math.hypot(b.x - at.x, b.z - at.z) : 0
    if (d < bestD) [best, bestD] = [p.id, d]
  }
  if (best) g.track(best)
  else g.setSearch(true)
}

export function Missions() {
  const userId = useMissions((s) => s.userId)
  const done = useMissions((s) => s.done)
  const hidden = useMissions((s) => s.hidden)
  const retired = useMissions((s) => s.retired)
  const collapsed = useMissions((s) => s.collapsed)
  const justDone = useMissions((s) => s.justDone)
  const district = useGame((s) => s.district)
  const busy = useGame(
    (s) => !!s.openId || s.searchOpen || s.paused || s.connectOpen || s.invitesOpen || s.statusOpen || s.portalOpen || !!s.travel,
  )
  const finished = allDone(done)
  const live = !!userId && !hidden && !retired

  // J folds the tracker to a chip and back
  useEffect(() => {
    if (!live) return
    const onKey = (e: KeyboardEvent) => {
      const g = useGame.getState()
      if (e.code !== 'KeyJ' || e.repeat || isTyping(e) || g.phase !== 'play') return
      if (g.openId || g.searchOpen || g.paused || g.connectOpen || g.invitesOpen || g.statusOpen || g.portalOpen) return
      useMissions.getState().toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [live])

  // all four: the complete tab shows for a moment, then the tracker retires for good
  useEffect(() => {
    if (!live || !finished) return
    const id = setTimeout(() => useMissions.getState().retire(), 6000)
    return () => clearTimeout(id)
  }, [live, finished])

  if (!live) return null
  const cls = `ms${busy ? ' ms--hidden' : ''}`

  if (finished)
    return (
      <div className={`${cls} ms-done slant`}>
        <span className="unslant">✓ DAY ZERO COMPLETE</span>
      </div>
    )

  const now = currentMission(done)
  const count = (
    <span className="ms-count">
      {done.length}/{MISSIONS.length}
    </span>
  )

  if (collapsed)
    return (
      <button className={`${cls} ms-chip slant`} onClick={() => useMissions.getState().toggle()} aria-label="Show missions">
        <span className="unslant">
          DAY ZERO {count} <span className="keycap">J</span>
        </span>
      </button>
    )

  return (
    <div className={`${cls} ms-card slant`}>
      <div className="unslant ms-body">
        <button className="ms-head" onClick={() => useMissions.getState().toggle()} aria-label="Fold missions">
          <span className="ms-k">DAY ZERO</span>
          {count}
          <span className="keycap">J</span>
        </button>
        {MISSIONS.map((m) => {
          const ok = done.includes(m.id)
          const on = m.id === now
          const stamp = ok && justDone?.id === m.id
          return (
            <button
              key={stamp ? `${m.id}-${justDone!.n}` : m.id}
              className={`ms-row${ok ? ' ms-row--done' : ''}${on ? ' ms-row--on' : ''}${stamp ? ' ms-row--stamp' : ''}`}
              onClick={() => !ok && go(m.id)}
              disabled={ok}
            >
              <span className="ms-box slant" aria-hidden>
                <span className="unslant">{ok ? '✓' : on ? '▸' : ''}</span>
              </span>
              <span className="ms-text">
                <span className="ms-title">
                  {m.title}
                  {m.bonus && <em className="ms-bonus">BONUS</em>}
                </span>
                {on && (
                  <span className="ms-hint">
                    {m.id === 'cross' ? `Take the portal to ${district === 'hsr' ? 'Koramangala' : 'HSR Layout'}.` : m.hint}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
