import { formatDuration, formatMiles } from './format'
import { routeColor, routeNumber } from './risk'
import type { Route } from './types'

/**
 * Where along each route its label sits. Routes often share a road at the start and
 * end, so giving each route a different spot keeps the labels from stacking.
 */
const LABEL_FRACTIONS = [0.35, 0.5, 0.65] as const

export const labelFraction = (routeId: string): number =>
  LABEL_FRACTIONS[(routeNumber(routeId) - 1) % LABEL_FRACTIONS.length]

const EARTH_RADIUS_MILES = 3958.8

function distanceMiles([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a))
}

/** The point a given fraction of the way along a line, measured by distance. */
export function pointAlong(
  geometry: [number, number][],
  fraction: number,
): { lat: number; lon: number } {
  if (geometry.length === 0) throw new Error('A route needs at least one point')
  const lengths = geometry.slice(1).map((point, i) => distanceMiles(geometry[i], point))
  const total = lengths.reduce((sum, length) => sum + length, 0)
  let remaining = total * Math.min(1, Math.max(0, fraction))
  for (const [i, length] of lengths.entries()) {
    if (remaining <= length || i === lengths.length - 1) {
      const share = length > 0 ? remaining / length : 0
      const [lat1, lon1] = geometry[i]
      const [lat2, lon2] = geometry[i + 1]
      return { lat: lat1 + (lat2 - lat1) * share, lon: lon1 + (lon2 - lon1) * share }
    }
    remaining -= length
  }
  return { lat: geometry[0][0], lon: geometry[0][1] }
}

/**
 * The label that sits on a route on the map: its name, distance, and drive time.
 * It is a button, so it works with a keyboard and screen reader, and choosing it
 * selects the route.
 */
export function routeChip(route: Route, selected: boolean, onSelect: () => void): HTMLButtonElement {
  const number = routeNumber(route.id)
  const miles = formatMiles(route.distance_miles)
  const time = formatDuration(route.duration_s)

  const chip = document.createElement('button')
  chip.type = 'button'
  chip.className = ['route-chip', selected && 'selected', route.recommended && 'recommended']
    .filter(Boolean)
    .join(' ')
  chip.style.setProperty('--route-color', routeColor(route.id))
  chip.setAttribute('aria-pressed', String(selected))
  chip.setAttribute(
    'aria-label',
    `Route ${number}${route.recommended ? ', recommended' : ''}, ${miles}, ${time}. Show this route.`,
  )

  const dot = document.createElement('i')
  dot.className = 'route-chip-dot'
  const name = document.createElement('strong')
  name.textContent = `Route ${number}`
  const details = document.createElement('span')
  details.textContent = `${miles} · ${time}`
  chip.append(dot, name)
  if (route.recommended) {
    const star = document.createElement('b')
    star.className = 'route-chip-star'
    star.setAttribute('aria-hidden', 'true')
    star.textContent = '★'
    chip.append(star)
  }
  chip.append(details)

  chip.addEventListener('click', (event) => {
    event.stopPropagation()
    onSelect()
  })
  return chip
}
