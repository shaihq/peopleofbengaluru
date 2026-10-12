'use client'

import { useGame } from '../store'
import { districtInfo } from '../districts/registry'
import { ConnectHud } from './Connections'
import { InvitesHud } from './Invites'
import { Missions } from './Missions'
import { useNet } from '../net/useNet'
import { useClock } from '../scene/time'
import { clockText, phaseAt } from '../scene/daylight'

function Keycap({ k, wide }: { k: string; wide?: boolean }) {
  return <span className={`keycap${wide ? ' keycap--wide' : ''}`}>{k}</span>
}

/** In-game HUD (design.md §10.4) — minimal; the world is the hero. */
export function HUD() {
  const phase = useGame((s) => s.phase)
  const landmark = useGame((s) => s.landmark)
  const locked = useGame((s) => s.pointerLocked)
  const talking = useGame((s) => !!s.openId || s.searchOpen || s.paused || s.connectOpen || s.invitesOpen)
  const district = useGame((s) => s.district)
  const info = districtInfo(district)
  // round trip to the live city, while connected
  const ping = useNet((s) => (s.status === 'live' ? s.ping : null))
  // Bengaluru's time, the same clock the light runs on
  const hour = useClock((s) => s.hour)

  if (phase !== 'play') return null

  return (
    <div className="hud">
      <div className="hud-location">
        <div className="slant panel">
          <div className="unslant">
            <div className="hud-city">BENGALURU</div>
            <div className="hud-district">{info.title}</div>
          </div>
        </div>
        <div key={landmark} className="slant hud-landmark">
          <span className="unslant">{landmark}</span>
        </div>
        <Missions />
      </div>

      <div className="hud-status">
        {ping !== null && (
          <div className="slant hud-pingtag" title="Round trip to the live city">
            <span className={`unslant hud-ping hud-ping--${ping < 80 ? 'good' : ping < 160 ? 'ok' : 'bad'}`}>
              <span className="hud-ping-bars" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              {ping} MS
            </span>
          </div>
        )}
        <div className="hud-find-row">
          <InvitesHud />
          <ConnectHud />
          <button className="slant hud-find" onClick={() => useGame.getState().setSearch(true)}>
            <span className="unslant">
              <span className="find-glass" /> FIND SOMEONE <span className="keycap">F</span>
            </span>
          </button>
        </div>
        <div className="slant hud-weather" title="Time in Bengaluru">
          <span className="unslant">
            {phaseAt(hour) === 'night' ? '☾' : '☀'} {clockText(hour)}
          </span>
        </div>
      </div>

      <div className={`hud-keys${talking ? ' hud-keys--hidden' : ''}`}>
        <div className="hud-key">
          <Keycap k="WASD" wide /> MOVE
        </div>
        <div className="hud-key">
          <Keycap k="SHIFT" wide /> RUN
        </div>
        <div className="hud-key">
          <Keycap k="MOUSE" wide /> LOOK
        </div>
        <div className="hud-key">
          <Keycap k="E" /> INTERACT
        </div>
        <div className="hud-key">
          <Keycap k="F" /> FIND
        </div>
        <div className="hud-key">
          <Keycap k="ESC" wide /> PAUSE
        </div>
      </div>

      {!locked && !talking && (
        <div className="hud-hint slant">
          <span className="unslant">CLICK TO LOOK AROUND</span>
        </div>
      )}
    </div>
  )
}
