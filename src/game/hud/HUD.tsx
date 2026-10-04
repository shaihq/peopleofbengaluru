'use client'

import { useGame } from '../store'
import { hasSamples, usePeople } from '../people/directory'
import { districtInfo, homeDistrict } from '../districts/registry'

function Keycap({ k, wide }: { k: string; wide?: boolean }) {
  return <span className={`keycap${wide ? ' keycap--wide' : ''}`}>{k}</span>
}

/** In-game HUD (design.md §10.4) — minimal; the world is the hero. */
export function HUD() {
  const phase = useGame((s) => s.phase)
  const landmark = useGame((s) => s.landmark)
  const locked = useGame((s) => s.pointerLocked)
  const talking = useGame((s) => !!s.openId || s.searchOpen || s.paused)
  const district = useGame((s) => s.district)
  const info = districtInfo(district)
  const people = usePeople().filter((p) => homeDistrict(p.location) === district)

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
      </div>

      <div className="hud-status">
        <div className="slant panel hud-online">
          <span className="unslant">
            <span className="dot" /> {people.length} <span className="hud-online-long">DESIGNERS IN {info.title}</span>
            <span className="hud-online-short">HERE</span>
          </span>
        </div>
        {hasSamples() && (
          <div className="slant hud-sample">
            <span className="unslant">INCLUDES SAMPLE PROFILES</span>
          </div>
        )}
        <button className="slant hud-find" onClick={() => useGame.getState().setSearch(true)}>
          <span className="unslant">
            <span className="find-glass" /> FIND SOMEONE <span className="keycap">F</span>
          </span>
        </button>
        <div className="slant hud-weather">
          <span className="unslant">☀ 27° · 10:40 AM</span>
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
