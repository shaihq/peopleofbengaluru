'use client'

import { useGame } from '../store'
import { activeStatus, useMyStatus } from '../status'
import { StatusBubble } from './StatusBubble'
import { useCanSetStatus } from './StatusEditor'

/** Your own status above your head — only while you edit it, as a live preview of what everyone else sees. */
export function MyStatusBubble() {
  const can = useCanSetStatus()
  const saved = useMyStatus((s) => s.status)
  const draft = useMyStatus((s) => s.draft)
  // you don't need to read your own status while walking around; it shows only in the editor
  const editing = useGame((s) => s.statusOpen)
  const s = activeStatus(draft ?? saved)
  if (!can || !editing || !s) return null
  return (
    <div className="np np--self" data-lod="near">
      <StatusBubble s={s} />
    </div>
  )
}
