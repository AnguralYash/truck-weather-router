import { describe, expect, it } from 'vitest'
import { TIME_SLOTS, defaultDeparture, formatDeparture, parseDeparture, toDeparture } from './datetime'

describe('departure helpers', () => {
  it('round-trips a departure string', () => {
    const { date, time } = parseDeparture('2026-11-03T14:30')

    expect(toDeparture(date, time)).toBe('2026-11-03T14:30')
  })

  it('defaults to 8 AM the next day', () => {
    expect(defaultDeparture(new Date(2026, 10, 30, 22, 15))).toBe('2026-12-01T08:00')
  })

  it('formats a departure for people', () => {
    expect(formatDeparture('2026-11-03T14:30')).toMatch(/Tue, Nov 3, 2:30\sPM/)
  })

  it('offers 48 half-hour slots with 12-hour labels', () => {
    expect(TIME_SLOTS).toHaveLength(48)
    expect(TIME_SLOTS[0]).toEqual({ value: '00:00', label: '12:00 AM' })
    expect(TIME_SLOTS[27]).toEqual({ value: '13:30', label: '1:30 PM' })
  })
})
