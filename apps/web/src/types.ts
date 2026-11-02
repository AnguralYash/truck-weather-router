export type RiskName = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' | 'NO_TRAVEL'

export interface Place {
  label: string
  lat: number
  lon: number
}

export interface PlanRequest {
  origin: Place
  destination: Place
  /** Local time at the origin, `YYYY-MM-DDTHH:MM`, with no offset. */
  departure: string
  loadLb: number
  spacingMiles: 10 | 25 | 50
}

export interface Checkpoint {
  mile: number
  lat: number
  lon: number
  eta_utc: string
  level: RiskName
  wind_mph: number
  rain_in_per_hr: number
  snow_in_per_hr: number
  wind_level: RiskName
  rain_level: RiskName
  snow_level: RiskName
}

export interface RouteSummary {
  miles_by_level: Record<RiskName, number>
  average_risk: number
  has_no_travel: boolean
}

export interface Route {
  id: string
  rank: number
  recommended: boolean
  distance_miles: number
  duration_s: number
  /** `[lat, lon]` pairs. */
  geometry: [number, number][]
  checkpoints: Checkpoint[]
  summary: RouteSummary
}

export interface HeatmapCell {
  lat: number
  lon: number
  /** Risk level 1-5 for each hour after departure, 0 to `hours`. */
  levels: number[]
}

export interface PlanResponse {
  departure_utc: string
  timezone: string
  spacing_miles: number
  load_lb: number
  recommended_route_id: string
  notice: string | null
  routes: Route[]
  heatmap: { hours: number; cells: HeatmapCell[] }
}
