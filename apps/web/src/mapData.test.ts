import { describe, expect, it } from 'vitest'
import { boundsOf, checkpointPopup, checkpointsGeoJSON, routesGeoJSON } from './mapData'
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
