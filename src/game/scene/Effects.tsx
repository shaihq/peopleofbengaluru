'use client'

import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { C } from '@/lib/palette'
import { quality } from '../device'

// design.md §7.2 — AO grounds everything; bloom only catches true light
// sources (high threshold); ACES; a light warm grade and vignette.
export function Effects() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {/* phones skip the AO pass — it's the most expensive effect */}
      {quality.ao ? <N8AO aoRadius={2.2} intensity={2.4} distanceFalloff={1.2} color={C.SHADOW_TINT} quality="medium" halfRes /> : <></>}
      <Bloom luminanceThreshold={2.6} luminanceSmoothing={0.2} intensity={0.45} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <HueSaturation saturation={0.1} />
      <BrightnessContrast brightness={0.01} contrast={0.05} />
      <Vignette offset={0.32} darkness={0.42} />
      {quality.smaa ? <SMAA /> : <></>}
    </EffectComposer>
  )
}
