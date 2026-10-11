import { describe, expect, it } from 'vitest'
import { bengaluruHour, clockText, KEYS, lightsOn, lookAt, parseTime, phaseAt } from './daylight'

describe('the clock', () => {
  it('runs on Bengaluru time wherever you are', () => {
    // 05:10 UTC = 10:40 IST
    expect(clockText(bengaluruHour(Date.UTC(2026, 9, 11, 5, 10)))).toBe('10:40 AM')
    // 20:00 UTC = 01:30 IST the next day
    expect(clockText(bengaluruHour(Date.UTC(2026, 9, 11, 20, 0)))).toBe('1:30 AM')
  })

  it('reads like a clock', () => {
    expect(clockText(0)).toBe('12:00 AM')
    expect(clockText(12.5)).toBe('12:30 PM')
    expect(clockText(19.25)).toBe('7:15 PM')
  })

  it('?time= takes HH:MM or HH, nothing else', () => {
    expect(parseTime('19:30')).toBe(19.5)
    expect(parseTime('6')).toBe(6)
    expect(parseTime('24:00')).toBeNull()
    expect(parseTime('7pm')).toBeNull()
    expect(parseTime(null)).toBeNull()
  })
})

describe('the light', () => {
  it('hits each key exactly at its hour', () => {
    for (const [h, look] of KEYS.slice(0, -1)) expect(lookAt(h)).toEqual(look)
  })

  it('blends between keys', () => {
    const l = lookAt(18.95)
    expect(l.night).toBeGreaterThan(0.6)
    expect(l.night).toBeLessThan(1)
    expect(l.sky).toMatch(/^#[0-9A-F]{6}$/)
  })

  it('is dark at night and light by day', () => {
    expect(lookAt(23).night).toBe(1)
    expect(lookAt(2).night).toBe(1)
    expect(lookAt(13).night).toBe(0)
    expect(lookAt(13).sunI).toBeGreaterThan(lookAt(23).sunI * 2)
  })

  it('the city lights are off by day, coming on at dusk, full at night', () => {
    expect(lightsOn(lookAt(13).night)).toBe(0)
    const dusk = lightsOn(lookAt(18.4).night)
    expect(dusk).toBeGreaterThan(0)
    expect(dusk).toBeLessThan(1)
    expect(lightsOn(lookAt(23).night)).toBe(1)
  })

  it('names the hour', () => {
    expect([4, 7, 13, 17.5, 21].map(phaseAt)).toEqual(['night', 'morning', 'day', 'evening', 'night'])
  })
})
