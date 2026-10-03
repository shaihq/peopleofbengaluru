'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { refreshDirectory } from './people/directory'
import { submitProfile, useOnboarding } from './onboarding'
import { useGame } from './store'

/** Keeps auth + the people directory in sync; finishes a profile after the magic-link round trip. */
export function Session() {
  useEffect(() => {
    refreshDirectory()
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange(async (event) => {
      await refreshDirectory()
      if (event === 'SIGNED_IN' && useOnboarding.getState().draft.pendingSubmit) {
        const r = await submitProfile()
        useGame
          .getState()
          .showToast(r.ok ? 'YOU’RE VISIBLE · LIVE FOR EVERYONE ONCE APPROVED' : `COULDN’T SAVE — ${r.error?.toUpperCase()}`, r.ok ? 'good' : 'bad')
      }
    })
    // keep the street fresh as new people get approved
    const id = setInterval(refreshDirectory, 60_000)
    return () => {
      data.subscription.unsubscribe()
      clearInterval(id)
    }
  }, [])
  return null
}
