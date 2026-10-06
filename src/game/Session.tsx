'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { refreshDirectory } from './people/directory'
import { redeemInvite, submitApplication, submitProfile, useOnboarding } from './onboarding'
import { useAccess } from './access'
import { useGame } from './store'

/** Keeps auth + the people directory in sync; finishes a profile after the magic-link round trip. */
export function Session() {
  useEffect(() => {
    refreshDirectory()
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange(async (event) => {
      await refreshDirectory()
      const d = useOnboarding.getState().draft
      if (event === 'SIGNED_IN' && d.pendingApply) {
        // pay path: the email is confirmed — save the application (nothing goes live)
        const r = await submitApplication()
        if (!r.ok) return useGame.getState().showToast(`COULDN’T SAVE — ${r.error?.toUpperCase()}`, 'bad')
        // they already pressed "submit + pay": carry on to the checkout
        useAccess.setState({ status: 'applied' })
        useGame.getState().showToast('EMAIL CONFIRMED · TAKING YOU TO PAYMENT', 'good')
        return useAccess.getState().pay()
      }
      // back from the Dodo checkout: ?paid=1&payment_id=…&status=…
      const back = new URLSearchParams(window.location.search)
      const paymentId = back.get('payment_id')
      if (paymentId && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
        const url = new URL(window.location.href)
        ;['paid', 'payment_id', 'status', 'subscription_id', 'email'].forEach((k) => url.searchParams.delete(k))
        window.history.replaceState(null, '', url)
        await useAccess.getState().confirmPayment(paymentId)
        return
      }
      await useAccess.getState().loadApplication()
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
