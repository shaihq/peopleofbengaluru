'use client'

import type { Status } from '../status'

/**
 * A person's status on their nameplate (Phase 5F): the saffron slanted tab under the
 * role — the slot and style that used to say BUILDING. Shown up close only, like the
 * rest of the nameplate's detail (see .np[data-lod] in globals.css).
 */
export function StatusBubble({ s }: { s: Status }) {
  return (
    <div className="np-building np-note">
      {s.emoji && <span className="np-note-e">{s.emoji}</span>}
      {s.text && <span className="np-note-t">{s.text}</span>}
    </div>
  )
}
