'use client'

import { useEffect, useState } from 'react'
import { useGame } from '../store'
import { activeStatus, useMyStatus } from '../status'
import { StatusBubble } from './StatusBubble'
import { useCanSetStatus } from './StatusEditor'

/** Your own status above your head — what everyone else sees; live while you edit it. */
export function MyStatusBubble() {
  const can = useCanSetStatus()
  const saved = useMyStatus((s) => s.status)
  const draft = useMyStatus((s) => s.draft)
  // next to someone, their status is the one that matters — yours steps aside (unless you're editing it)
  const busy = useGame((s) => !!s.openId || s.searchOpen || s.paused || !!s.travel || (!!s.focusId && !s.statusOpen))
  // re-check expiry once a minute so a cleared status drops off on its own
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])
  const s = activeStatus(draft ?? saved)
  if (!can || busy || !s) return null
  return (
    <div className="np np--self" data-lod="near">
      <StatusBubble s={s} />
    </div>
  )
}
