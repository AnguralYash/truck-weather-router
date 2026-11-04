import { describe, expect, it, vi } from 'vitest'
import { labelFraction, pointAlong, routeChip } from './routeLabels'
import { planResponse } from './test/fixtures'

const [recommended, other] = planResponse.routes

describe('labelFraction', () => {
  it('puts the three routes at different spots so shared roads do not stack labels', () => {
    const fractions = ['route-1', 'route-2', 'route-3'].map(labelFraction)

    expect(new Set(fractions).size).toBe(3)
    expect(fractions.every((fraction) => fraction > 0 && fraction < 1)).toBe(true)
  })
})

describe('pointAlong', () => {
  const line: [number, number][] = [
    [40, -90],
    [40, -89],
    [40, -88],
  ]

  it('finds the middle of a straight line', () => {
    const middle = pointAlong(line, 0.5)

    expect(middle.lat).toBeCloseTo(40)
    expect(middle.lon).toBeCloseTo(-89)
  })

  it('measures by distance, not by number of points', () => {
    // The first segment is one degree long and the second is three.
    const uneven: [number, number][] = [
      [40, -90],
      [40, -89],
      [40, -86],
    ]

    expect(pointAlong(uneven, 0.5).lon).toBeCloseTo(-88, 0)
  })

  it('stays on the line at the ends', () => {
    expect(pointAlong(line, 0)).toEqual({ lat: 40, lon: -90 })
    expect(pointAlong(line, 1).lon).toBeCloseTo(-88)
    expect(pointAlong(line, -3)).toEqual({ lat: 40, lon: -90 })
    expect(pointAlong(line, 9).lon).toBeCloseTo(-88)
  })

  it('handles a route made of one segment', () => {
    expect(pointAlong([[40, -90], [42, -90]], 0.25).lat).toBeCloseTo(40.5)
  })

  it('refuses an empty route', () => {
    expect(() => pointAlong([], 0.5)).toThrow()
  })
})

describe('routeChip', () => {
  it('shows the route name, distance, and drive time', () => {
    const chip = routeChip(other, false, vi.fn())

    expect(chip.textContent).toContain('Route 1')
    expect(chip.textContent).toContain('297 mi')
    expect(chip.textContent).toContain('5 h')
  })

  it('marks the recommended route with a star and says so to screen readers', () => {
    const chip = routeChip(recommended, true, vi.fn())

    expect(chip.querySelector('.route-chip-star')).not.toBeNull()
    expect(chip.getAttribute('aria-label')).toMatch(/Route 2, recommended, 312 mi/)
    expect(chip.classList.contains('recommended')).toBe(true)
    expect(chip.classList.contains('selected')).toBe(true)
    expect(chip.getAttribute('aria-pressed')).toBe('true')
  })

  it('has no star on routes that are not recommended', () => {
    const chip = routeChip(other, false, vi.fn())

    expect(chip.querySelector('.route-chip-star')).toBeNull()
    expect(chip.getAttribute('aria-pressed')).toBe('false')
  })

  it('uses the route color and selects the route when clicked', () => {
    const onSelect = vi.fn()
    const chip = routeChip(other, false, onSelect)

    chip.click()

    expect(chip.style.getPropertyValue('--route-color')).toBe('#1c7ed6')
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('does not let the click reach the map underneath', () => {
    const chip = routeChip(other, false, vi.fn())
    const reachedMap = vi.fn()
    const parent = document.createElement('div')
    parent.addEventListener('click', reachedMap)
    parent.append(chip)

    chip.click()

    expect(reachedMap).not.toHaveBeenCalled()
  })
})
