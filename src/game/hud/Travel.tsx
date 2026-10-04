'use client'

import { useEffect } from 'react'
import { districtInfo, districtOfLocation } from '../districts/registry'
import { getPeople } from '../people/directory'
import { requestLook } from '../player/input'
import { useGame } from '../store'

// panels: 0.6s each, staggered 0.05s → fully closed at ~0.8s. Swap only once they all are.
const COVER = 900
const CARD = 1200 // on-screen time AFTER the new district has finished loading
const REVEAL = 900

/**
 * Portal travel (design.md §14): slanted panels wipe in, the destination's
 * title card holds while the new district loads behind it, then the panels
 * wipe away. The card IS the loading screen.
 */
export function Travel() {
  const travel = useGame((s) => s.travel)
  const setTravelStage = useGame((s) => s.setTravelStage)

  useEffect(() => {
    if (!travel) return
    const g = useGame.getState()
    let id: ReturnType<typeof setTimeout>
    if (travel.stage === 'cover')
      id = setTimeout(() => {
        // two frames so the closed panels are painted before the (heavy) world swap
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            g.setDistrict(travel.to) // swap the world while the screen is covered
            setTravelStage('card')
          }),
        )
      }, COVER)
    else if (travel.stage === 'card') {
      // the swap just committed (that's the heavy frame); count the card's time from the next painted frame
      let raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => {
          id = setTimeout(() => setTravelStage('reveal'), CARD)
        })
      })
      return () => {
        cancelAnimationFrame(raf)
        clearTimeout(id)
      }
    }
    else
      id = setTimeout(() => {
        setTravelStage(null)
        requestLook()
        if (travel.findId) setTimeout(() => useGame.getState().track(travel.findId!), 350)
        else useGame.getState().showToast(`WELCOME TO ${districtInfo(travel.to).title}`, 'info')
      }, REVEAL)
    return () => clearTimeout(id)
  }, [travel, setTravelStage])

  if (!travel) return null
  const d = districtInfo(travel.to)
  const n = getPeople().filter((p) => districtOfLocation(p.location).id === d.id).length
  return (
    <div className={`warp-overlay warp-overlay--${travel.stage}`} style={{ ['--accent' as string]: d.accent }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="warp-panel" style={{ ['--i' as string]: i }} />
      ))}
      <div className="warp-card">
        <div className="warp-card-kicker">ARRIVING IN</div>
        <div className="warp-card-title">{d.title}</div>
        <div className="warp-card-kn">{d.kn}</div>
        <div className="warp-card-id">{d.identity}</div>
        <div className="warp-card-n">
          <span className="np-dot" /> {n} DESIGNER{n === 1 ? '' : 'S'} LIVE HERE
        </div>
      </div>
    </div>
  )
}
