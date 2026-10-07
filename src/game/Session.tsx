'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { refreshDirectory, useDirectory } from './people/directory'
import { redeemInvite, submitApplication, submitProfile, useOnboarding } from './onboarding'
import { SIGNIN_KEY, useAccess } from './access'
import { useGame } from './store'
import { useConnect } from './connect'

/** Requests, matches and your contact (Phase 5G). Members only; a no-op otherwise. */
function refreshConnect() {
  const c = useConnect.getState()
  if (!useDirectory.getState().userId) return c.reset()
  void c.loadContact()
  void c.load()
}

/** True once, right after a sign-in link sent from the sign-in screen comes back. */
function takeSignin() {
  try {
    if (!localStorage.getItem(SIGNIN_KEY)) return false
    localStorage.removeItem(SIGNIN_KEY)
    return true
  } catch {
    return false
  }
}

/** Keeps auth + the people directory in sync; finishes a profile after the magic-link round trip. */
export function Session() {
  useEffect(() => {
    refreshDirectory()
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange(async (event) => {
      await refreshDirectory()
      refreshConnect()
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
      if (event === 'SIGNED_IN' && takeSignin()) {
        // back from a plain sign-in: say where they stand
        const { me } = useDirectory.getState()
        const st = useAccess.getState().status
        const msg = me
          ? 'WELCOME BACK'
          : st === 'applied'
            ? 'WELCOME BACK · PAY TO SEND YOUR APPLICATION'
            : st === 'review'
              ? 'WELCOME BACK · YOUR APPLICATION IS UNDER REVIEW'
              : st === 'rejected'
                ? 'WELCOME BACK · SEE YOUR APPLICATION'
                : 'SIGNED IN'
        useGame.getState().showToast(msg, 'good')
        return
      }
      if (event === 'SIGNED_IN' && d.pendingSubmit) {
        // invite path: the code makes you live instantly; otherwise the old profile save
        const r = d.pendingInvite ? await redeemInvite() : await submitProfile()
        const okMsg = d.pendingInvite ? 'YOU’RE LIVE · WELCOME TO THE CITY' : 'YOU’RE VISIBLE · LIVE FOR EVERYONE ONCE APPROVED'
        useGame.getState().showToast(r.ok ? okMsg : `COULDN’T FINISH — ${r.error?.toUpperCase()}`, r.ok ? 'good' : 'bad')
      }
    })
    // keep the street fresh as new people get approved
    // and your connections: new requests and matches show up within a minute, or when you come back
    const tick = async () => {
      await refreshDirectory()
      refreshConnect()
    }
    const id = setInterval(tick, 60_000)
    const onVisible = () => document.visibilityState === 'visible' && void tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      data.subscription.unsubscribe()
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return null
}
