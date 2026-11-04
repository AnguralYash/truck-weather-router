import { describe, expect, it } from 'vitest'
import {
  boundsOf,
  checkpointPopup,
  checkpointsGeoJSON,
  heatmapGeoJSON,
  heatmapRadius,
  heatmapWeight,
  routesGeoJSON,
} from './mapData'
import { planResponse, route } from './test/fixtures'
import type { Checkpoint } from './types'

const checkpoint: Checkpoint = {
  mile: 75.2,
  lat: 40.9,
  lon: -87.9,
  eta_utc: '2026-11-03T19:10:00+00:00',
  level: 'HIGH',
  wind_mph: 38.4,
  rain_in_per_hr: 0.05,
  snow_in_per_hr: 0,
  wind_level: 'HIGH',
  rain_level: 'LOW',
  snow_level: 'LOW',
}

describe('routesGeoJSON', () => {
  it('flips coordinates to longitude, latitude and marks the selected route', () => {
    const collection = routesGeoJSON(planResponse.routes, 'route-1')

    const first = collection.features[0]
    expect(first.geometry.coordinates[0]).toEqual([-87.63, 41.88])
    expect(collection.features.map((f) => [f.properties?.id, f.properties?.selected])).toEqual([
      ['route-2', 0],
      ['route-1', 1],
      ['route-3', 0],
    ])
  })

  it('colors each route by its own number, not its rank', () => {
    const colors = routesGeoJSON(planResponse.routes, 'route-2').features.map((f) => f.properties?.color)

    expect(new Set(colors).size).toBe(3)
    expect(colors[0]).toBe('#7048e8')
  })
})

describe('checkpointsGeoJSON', () => {
  it('has a colored point for every checkpoint of the route', () => {
    const withCheckpoints = route('route-1', 1, { checkpoints: [checkpoint, { ...checkpoint, level: 'LOW' }] })

    const collection = checkpointsGeoJSON(withCheckpoints)

    expect(collection.features).toHaveLength(2)
    expect(collection.features[0].properties?.color).toBe('#f08c00')
    expect(collection.features[1].properties?.color).toBe('#2f9e44')
    expect(collection.features[0].geometry.coordinates).toEqual([-87.9, 40.9])
  })

  it('is empty without a route', () => {
    expect(checkpointsGeoJSON(undefined).features).toEqual([])
  })
})

describe('boundsOf', () => {
  it('covers every point of every route', () => {
    expect(boundsOf(planResponse.routes)).toEqual({ west: -90.2, south: 38.63, east: -87.63, north: 41.88 })
  })

  it('is null when there are no routes', () => {
    expect(boundsOf([])).toBeNull()
  })
})

describe('checkpointPopup', () => {
  it('shows mile, arrival in the origin zone, and each weather reading', () => {
    const popup = checkpointPopup(checkpoint, 'America/Chicago')

    expect(popup.textContent).toContain('Mile 75')
    expect(popup.textContent).toMatch(/Arrive Tue, 1:10\sPM CST/)
    expect(popup.textContent).toContain('High risk')
    expect(popup.textContent).toContain('38 mph')
    expect(popup.textContent).toContain('0.05 in/hr')
  })

  it('never treats data as markup', () => {
    const popup = checkpointPopup({ ...checkpoint, level: 'LOW' }, 'America/Chicago')

    expect(popup.querySelector('script')).toBeNull()
  })
})

describe('heatmap helpers', () => {
  const heatmap = {
    hours: 2,
    cell_degrees: 0.2,
    cells: [
      { lat: 41.8, lon: -87.6, levels: [1, 3, 5] },
      { lat: 41.6, lon: -87.8, levels: [2, 2, 4] },
    ],
  }

  it('gives every hour its own numeric property, because arrays do not survive tiling', () => {
    const collection = heatmapGeoJSON(heatmap)

    expect(collection.features[0].properties).toEqual({ h0: 1, h1: 3, h2: 5 })
    expect(collection.features[0].geometry.coordinates).toEqual([-87.6, 41.8])
    expect(collection.features[1].properties).toEqual({ h0: 2, h1: 2, h2: 4 })
  })

  it('weights a cell by its risk level at the chosen hour', () => {
    expect(heatmapWeight(1)).toEqual(['/', ['coalesce', ['get', 'h1'], 1], 5])
  })

  it('sizes the glow to the cell width and doubles it with every zoom level', () => {
    const [, , , zoomLow, radiusLow, zoomHigh, radiusHigh] = heatmapRadius(0.36) as unknown as [
      string, unknown, unknown, number, number, number, number,
    ]

    // 0.36 degrees at 512 px per world is 0.512 px; the glow spans two cells.
    expect(zoomLow).toBe(0)
    expect(radiusLow).toBeCloseTo(1.024)
    expect(radiusHigh / radiusLow).toBeCloseTo(2 ** zoomHigh)
  })
})
