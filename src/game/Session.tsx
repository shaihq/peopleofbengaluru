'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { refreshDirectory } from './people/directory'
import { redeemInvite, submitProfile, useOnboarding } from './onboarding'
import { useGame } from './store'

/** Keeps auth + the people directory in sync; finishes a profile after the magic-link round trip. */
export function Session() {
  useEffect(() => {
    refreshDirectory()
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange(async (event) => {
      await refreshDirectory()
      const d = useOnboarding.getState().draft
      if (event === 'SIGNED_IN' && d.pendingSubmit) {
        // invite path: the code makes you live instantly; otherwise the old profile save
        const r = d.pendingInvite ? await redeemInvite() : await submitProfile()
        const okMsg = d.pendingInvite ? 'YOU’RE LIVE · WELCOME TO THE CITY' : 'YOU’RE VISIBLE · LIVE FOR EVERYONE ONCE APPROVED'
        useGame.getState().showToast(r.ok ? okMsg : `COULDN’T FINISH — ${r.error?.toUpperCase()}`, r.ok ? 'good' : 'bad')
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
