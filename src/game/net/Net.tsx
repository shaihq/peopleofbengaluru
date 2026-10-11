'use client'

import { useEffect } from 'react'
import { getPeople, refreshDirectory } from '../people/directory'
import { startNet } from './client'
import { useNet } from './useNet'

const REFRESH_GAP_MS = 10_000

/** The LIVE CITY connection (CLAUDE.md Phase 8A). Renders nothing. */
export function Net() {
  useEffect(() => startNet(), [])

  // someone live we don't know yet (approved since the last directory read): fetch the directory again
  useEffect(() => {
    let last = 0
    return useNet.subscribe((s, p) => {
      if (s.live === p.live || Date.now() - last < REFRESH_GAP_MS) return
      const known = new Set(getPeople().map((x) => x.id))
      if ([...s.live].some((id) => !known.has(id))) {
        last = Date.now()
        void refreshDirectory()
      }
    })
  }, [])

  return null
}
