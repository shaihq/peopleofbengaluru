// DAY ZERO missions (CLAUDE.md "Day Zero missions"): four first things a new member does in the city.
// The rules, as plain functions (tested in missions.test.ts); the store that follows the game is missionsStore.ts.

export type MissionId = 'note' | 'reach' | 'cross' | 'invite'

export const MISSIONS: { id: MissionId; title: string; hint: string; bonus?: boolean }[] = [
  { id: 'note', title: 'PUT YOUR NOTE UP', hint: 'Tell the street what you’re here for.' },
  { id: 'reach', title: 'OFF THE USUAL PATH', hint: 'Walk up to someone whose note you like and say hi.' },
  { id: 'cross', title: 'CROSS OVER', hint: 'Take the portal to another district.' },
  { id: 'invite', title: 'PASS IT ON', hint: 'Share one of your invite codes.', bonus: true },
]

/** Newly true facts join the done list (in mission order); nothing ever leaves it. */
export function latch(done: MissionId[], facts: Partial<Record<MissionId, boolean>>): MissionId[] {
  const next = MISSIONS.filter((m) => done.includes(m.id) || facts[m.id]).map((m) => m.id)
  return next.length === done.length ? done : next
}

/** The first mission not done yet, or null when they all are. */
export const currentMission = (done: MissionId[]): MissionId | null => MISSIONS.find((m) => !done.includes(m.id))?.id ?? null

export const allDone = (done: MissionId[]) => currentMission(done) === null
