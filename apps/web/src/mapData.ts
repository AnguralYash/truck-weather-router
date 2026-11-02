import type { FeatureCollection, LineString, Point } from 'geojson'
import { formatEta } from './datetime'
import { riskByName, routeColor } from './risk'
import type { Checkpoint, Route } from './types'

type LngLat = [number, number]

export interface Bounds {
  west: number
  south: number
  east: number
  north: number
}

const toLngLat = ([lat, lon]: [number, number]): LngLat => [lon, lat]

/** All routes as lines. The selected route sorts last, so it draws on top. */
export function routesGeoJSON(
  routes: Route[],
  selectedId: string,
): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: routes.map((route) => ({
      type: 'Feature',
      properties: {
        id: route.id,
        color: routeColor(route.id),
        selected: route.id === selectedId ? 1 : 0,
      },
      geometry: { type: 'LineString', coordinates: route.geometry.map(toLngLat) },
    })),
  }
}

/** Checkpoint dots for one route, colored by risk. */
export function checkpointsGeoJSON(
  route: Route | undefined,
): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: (route?.checkpoints ?? []).map((checkpoint, index) => ({
      type: 'Feature',
      properties: { index, color: riskByName(checkpoint.level).color },
      geometry: { type: 'Point', coordinates: [checkpoint.lon, checkpoint.lat] },
    })),
  }
}

export function boundsOf(routes: Route[]): Bounds | null {
  const points = routes.flatMap((route) => route.geometry)
  if (points.length === 0) return null
  const lats = points.map(([lat]) => lat)
  const lons = points.map(([, lon]) => lon)
  return {
    west: Math.min(...lons),
    south: Math.min(...lats),
    east: Math.max(...lons),
    north: Math.max(...lats),
  }
}

function row(label: string, value: string, level: string): HTMLElement {
  const element = document.createElement('div')
  element.className = 'popup-row'
  const name = document.createElement('span')
  name.textContent = label
  const reading = document.createElement('span')
  reading.textContent = value
  const badge = document.createElement('i')
  badge.textContent = riskByName(level as Checkpoint['level']).label
  badge.style.background = riskByName(level as Checkpoint['level']).color
  badge.className = 'popup-badge'
  element.append(name, reading, badge)
  return element
}

/** The content of a checkpoint popup, built with DOM calls so nothing is parsed as HTML. */
export function checkpointPopup(checkpoint: Checkpoint, timeZone: string): HTMLElement {
  const risk = riskByName(checkpoint.level)
  const root = document.createElement('div')
  root.className = 'popup'

  const title = document.createElement('strong')
  title.textContent = `Mile ${Math.round(checkpoint.mile)}`
  const eta = document.createElement('div')
  eta.className = 'popup-eta'
  eta.textContent = `Arrive ${formatEta(checkpoint.eta_utc, timeZone)}`
  const overall = document.createElement('div')
  overall.className = 'popup-overall'
  overall.style.background = risk.color
  overall.textContent = `${risk.label} risk`

  root.append(
    title,
    eta,
    overall,
    row('Wind', `${checkpoint.wind_mph.toFixed(0)} mph`, checkpoint.wind_level),
    row('Rain', `${checkpoint.rain_in_per_hr.toFixed(2)} in/hr`, checkpoint.rain_level),
    row('Snow', `${checkpoint.snow_in_per_hr.toFixed(2)} in/hr`, checkpoint.snow_level),
  )
  return root
}
