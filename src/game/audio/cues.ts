import { sfx } from './sfx'
import { useGame } from '../store'

// Discovery cue (sounddesign.md §7–8) with the anti-spam rules from §21:
// once per person per approach (90s memory), never more than one every 5s.

const seen = new Map<string, number>()
let last = 0

export function revealed(id: string, x: number, y: number, z: number) {
  const g = useGame.getState()
  if (g.phase !== 'play' || g.paused || g.searchOpen || g.openId || g.trackStage === 'fly' || g.trackStage === 'hold') return
  const now = performance.now()
  if (now - (seen.get(id) ?? -1e9) < 90_000 || now - last < 5000) return
  seen.set(id, now)
  last = now
  sfx.discovery(x, y, z)
}
