import type { PlanResponse, Route } from '../types'

const miles = (low: number, high = 0, noTravel = 0) => ({
  LOW: low,
  MODERATE: 0,
  HIGH: high,
  SEVERE: 0,
  NO_TRAVEL: noTravel,
})

export function route(id: string, rank: number, overrides: Partial<Route> = {}): Route {
  return {
    id,
    rank,
    recommended: rank === 1,
    distance_miles: 300,
    duration_s: 5 * 3600,
    geometry: [
      [41.88, -87.63],
      [38.63, -90.2],
    ],
    checkpoints: [],
    summary: { miles_by_level: miles(300), average_risk: 1, has_no_travel: false },
    ranking_note: null,
    ...overrides,
  }
}

export const planResponse: PlanResponse = {
  departure_utc: '2026-11-03T14:00:00+00:00',
  timezone: 'America/Chicago',
  spacing_miles: 25,
  load_lb: 42000,
  recommended_route_id: 'route-2',
  notice: null,
  routes: [
    route('route-2', 1, {
      distance_miles: 312,
      duration_s: 4.9 * 3600,
      ranking_note: 'Fewest High-risk miles: 0 mi vs 25 mi on Route 1.',
    }),
    route('route-1', 2, {
      distance_miles: 297,
      ranking_note: '25 mi of High risk (recommended route: 0 mi).',
      summary: { miles_by_level: miles(272, 25), average_risk: 1.17, has_no_travel: false },
    }),
    route('route-3', 3, {
      summary: { miles_by_level: miles(290, 0, 10), average_risk: 1.13, has_no_travel: true },
    }),
  ],
  heatmap: { hours: 48, cell_degrees: 0.2, cells: [] },
}
