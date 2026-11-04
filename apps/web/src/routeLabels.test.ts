import { describe, expect, it, vi } from 'vitest'
import {
  labelFraction,
  labelFractionFor,
  pointAlong,
  routeChip,
  separateLabels,
} from './routeLabels'
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

describe('separateLabels', () => {
  const box = (id: string, x: number, y: number) => ({ id, x, y, width: 180, height: 28 })

  it('leaves labels that do not touch where they are', () => {
    const shifts = separateLabels([box('a', 100, 100), box('b', 500, 100), box('c', 100, 400)])

    expect(shifts).toEqual({ a: 0, b: 0, c: 0 })
  })

  it('keeps the first label in place and moves a later one that would cover it', () => {
    const shifts = separateLabels([box('selected', 300, 200), box('other', 340, 204)])

    expect(shifts.selected).toBe(0)
    // Up by one step would still leave under the minimum gap, so it goes down.
    expect(shifts.other).toBe(34)
  })

  it('stacks three labels on one spot without any overlapping', () => {
    const boxes = [box('a', 300, 200), box('b', 300, 200), box('c', 300, 200)]

    const shifts = separateLabels(boxes)

    const tops = boxes.map((b) => b.y + shifts[b.id] - b.height / 2).sort((x, y) => x - y)
    expect(tops[1] - tops[0]).toBeGreaterThanOrEqual(28)
    expect(tops[2] - tops[1]).toBeGreaterThanOrEqual(28)
    expect(shifts).toEqual({ a: 0, b: -34, c: 34 })
  })

  it('does not move a label that only sits beside another', () => {
    const shifts = separateLabels([box('a', 100, 100), box('b', 100 + 180 + 20, 100)])

    expect(shifts.b).toBe(0)
  })

  it('handles no labels', () => {
    expect(separateLabels([])).toEqual({})
  })
})

describe('labelFractionFor', () => {
  const line = (points: [number, number][]) => ({ ...other, geometry: points })

  // Two routes follow one road for the first half, then split, one north and one south.
  const shared: [number, number][] = Array.from({ length: 11 }, (_, i) => [40, -90 + i * 0.1])
  const north = line([...shared, ...Array.from({ length: 11 }, (_, i): [number, number] => [40 + i * 0.05, -89 + i * 0.1])])
  const south = {
    ...line([...shared, ...Array.from({ length: 11 }, (_, i): [number, number] => [40 - i * 0.05, -89 + i * 0.1])]),
    id: 'route-2',
  }

  it('puts a label on the stretch that is not shared with another route', () => {
    const fraction = labelFractionFor(north, [south])

    // The shared half is the first 50% of the way; the label must be past it.
    expect(fraction).toBeGreaterThan(0.5)
    expect(fraction).toBeLessThan(0.9)
  })

  it('does the same for the other route, so each label sits on its own line', () => {
    expect(labelFractionFor(south, [north])).toBeGreaterThan(0.5)
  })

  it('keeps the default spot when a route is shared all the way', () => {
    const twin = { ...north, id: 'route-2' }

    expect(labelFractionFor(north, [twin])).toBe(labelFraction(north.id))
  })

  it('keeps the default spot when there is only one route', () => {
    expect(labelFractionFor(north, [])).toBe(labelFraction(north.id))
  })

  it('chooses a spot on a route that does not touch the others, near its middle', () => {
    const faraway = line([
      [30, -100],
      [30, -99],
      [30, -98],
      [30, -97],
    ])

    expect(labelFractionFor(faraway, [north])).toBeCloseTo(0.5, 1)
  })
})
