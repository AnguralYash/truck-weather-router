import { describe, expect, it } from 'vitest'
import { formatDuration, formatMiles, formatPounds } from './format'

describe('formatting', () => {
  it('formats durations', () => {
    expect(formatDuration(45 * 60)).toBe('45 min')
    expect(formatDuration(2 * 3600)).toBe('2 h')
    expect(formatDuration(4 * 3600 + 42 * 60)).toBe('4 h 42 min')
  })

  it('formats miles and pounds', () => {
    expect(formatMiles(1311.6)).toBe('1,312 mi')
    expect(formatPounds(42000)).toBe('42,000 lb')
  })
})
