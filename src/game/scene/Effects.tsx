'use client'

import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { C } from '@/lib/palette'
import { useMemo } from 'react'
import { flag, isTouch, profile, showQualityDebug, useDebugToggles, useQuality } from '../device'
import { Grade } from './grade'

// design.md §7.2 — AO grounds everything; bloom only catches true light
// sources (high threshold); ACES; a light warm grade and vignette.
export function Effects() {
  const ao = profile(useQuality((s) => s.level)).ao
  const post = flag('post')
  const t = useDebugToggles()
  const dbg = showQualityDebug
  const grade = useMemo(() => new Grade(), [])
  if (post === 'off') return null
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {/* AO grounds the whole look; only the lowest adaptive step drops it */}
      {ao ? <N8AO aoRadius={2.2} intensity={2.4} distanceFalloff={1.2} color={C.SHADOW_TINT} quality={ao} halfRes /> : <></>}
      {post === 'nobloom' || (dbg && !t.bloom) ? <></> : <Bloom luminanceThreshold={2.6} luminanceSmoothing={0.2} intensity={0.45} mipmapBlur />}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <primitive object={grade} />
      <Vignette offset={0.32} darkness={0.42} />
      {/* phones render at 2x, which already smooths edges; SMAA is a desktop cost */}
      {post === 'nosmaa' || (isTouch && post !== 'smaa') ? <></> : <SMAA />}
    </EffectComposer>
  )
}
