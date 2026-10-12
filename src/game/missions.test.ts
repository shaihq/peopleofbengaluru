import { describe, expect, it } from 'vitest'
import { allDone, currentMission, latch } from './missions'

describe('latch', () => {
  it('adds newly true missions in mission order', () => {
    expect(latch([], { invite: true, note: true })).toEqual(['note', 'invite'])
  })

  it('never un-completes a mission', () => {
    expect(latch(['note', 'reach'], { note: false })).toEqual(['note', 'reach'])
  })

  it('returns the same list when nothing changed', () => {
    const done = ['note' as const]
    expect(latch(done, { note: true, reach: false })).toBe(done)
  })
})

describe('currentMission', () => {
  it('is the first one not done, even if a later one is', () => {
    expect(currentMission([])).toBe('note')
    expect(currentMission(['note', 'invite'])).toBe('reach')
  })

  it('is null when all four are done', () => {
    const done = latch([], { note: true, reach: true, cross: true, invite: true })
    expect(currentMission(done)).toBeNull()
    expect(allDone(done)).toBe(true)
    expect(allDone(['note', 'reach', 'cross'])).toBe(false)
  })
})
