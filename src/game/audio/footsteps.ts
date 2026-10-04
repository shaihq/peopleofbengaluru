import { at, out, playSample, ready } from './engine'
import { PARK, ROAD } from '../layout'
import { styleOf } from '../characters/roster'

// Footsteps respond to the surface (sounddesign.md §6). One plain step per
// animation footfall — no extra layers. CC0 Kenney samples, randomised
// (5 variations × slight pitch jitter) so they never sound looped.

type Surface = 'asphalt' | 'pavers' | 'grass' | 'kota'

export function surfaceAt(x: number, z: number): Surface {
  if (Math.abs(x) < ROAD || Math.abs(z) < ROAD) return 'asphalt'
  if (x > PARK.x0 && x < PARK.x1 && z > PARK.z0 && z < PARK.z1) {
    const loop = Math.abs(Math.max(Math.abs(x - 20), Math.abs(z - 20)) - 7) < 0.85
    return loop ? 'pavers' : 'grass'
  }
  if (z < -8 && z > -11.6 && x > 9 && x < 45) return 'kota'
  if (x > -20 && x < -10 && z > 10.9 && z < 13.1) return 'kota'
  return 'pavers'
}

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
