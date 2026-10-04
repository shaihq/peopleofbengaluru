import { at, out, playSample, ready } from './engine'
import { active, type Surface } from '../districts/active'
import { styleOf } from '../characters/roster'

// Footsteps respond to the surface (sounddesign.md §6). One plain step per
// animation footfall — no extra layers. CC0 Kenney samples, randomised
// (5 variations × slight pitch jitter) so they never sound looped.

export const surfaceAt = (x: number, z: number) => active.def.surface(x, z)

const SET: Record<Surface, { base: string; rate: number; gain: number }> = {
  asphalt: { base: 'footstep_concrete', rate: 0.9, gain: 0.55 },
  pavers: { base: 'footstep_concrete', rate: 1.02, gain: 0.6 },
  grass: { base: 'footstep_grass', rate: 1, gain: 0.7 },
  kota: { base: 'footstep_wood', rate: 1.2, gain: 0.45 },
}

// Only weight differs between characters — heavier builds step a little lower.
const WEIGHT: Record<string, number> = { moonshot: 0.85, hero: 0.92, bot: 0.9 }

export function footstep(characterId: string, x: number, y: number, z: number, running: boolean, local: boolean) {
  if (!ready()) return
  const s = SET[surfaceAt(x, z)]
  const rate = s.rate * (WEIGHT[styleOf(characterId)] ?? 1) * (0.95 + Math.random() * 0.1)
  const gain = s.gain * (running ? 1 : 0.7) * (local ? 0.75 : 0.9)
  playSample(`${s.base}_00${Math.floor(Math.random() * 5)}`, { at: local ? out('sfx') : at(x, y + 0.1, z, 'sfx', 2.5), rate, gain })
}

export const STEP_SAMPLES = ['concrete', 'grass', 'wood'].flatMap((s) => [0, 1, 2, 3, 4].map((i) => `footstep_${s}_00${i}`))
