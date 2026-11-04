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

export interface LabelBox {
  id: string
  /** Where the label's centre sits on screen, in pixels. */
  x: number
  y: number
  width: number
  height: number
}

const LABEL_GAP_PX = 6

interface Rect {
  left: number
  right: number
  top: number
  bottom: number
}

const rectOf = (box: LabelBox, shift: number): Rect => ({
  left: box.x - box.width / 2,
  right: box.x + box.width / 2,
  top: box.y + shift - box.height / 2,
  bottom: box.y + shift + box.height / 2,
})

const overlaps = (a: Rect, b: Rect): boolean =>
  a.left < b.right + LABEL_GAP_PX &&
  a.right + LABEL_GAP_PX > b.left &&
  a.top < b.bottom + LABEL_GAP_PX &&
  a.bottom + LABEL_GAP_PX > b.top

/**
 * How far to move each label up or down so none cover another. Labels come in
 * priority order: the first stays on its route, and each later one takes the
 * nearest free spot, trying the position on its route first, then alternately
 * above and below it. Returns a vertical shift in pixels for every label.
 */
export function separateLabels(boxes: LabelBox[]): Record<string, number> {
  const placed: Rect[] = []
  const shifts: Record<string, number> = {}
  for (const box of boxes) {
    const step = box.height + LABEL_GAP_PX
    const candidates = [0, -step, step, -2 * step, 2 * step, -3 * step, 3 * step]
    const shift =
      candidates.find((candidate) => !placed.some((other) => overlaps(rectOf(box, candidate), other))) ?? 0
    shifts[box.id] = shift
    placed.push(rectOf(box, shift))
  }
  return shifts
}

const CANDIDATE_FRACTIONS = Array.from({ length: 33 }, (_, i) => 0.1 + i * 0.025)

/** Closer than this to another route, a stretch of road counts as shared. */
const SHARED_ROAD_MILES = 1

const MILES_PER_DEGREE = 69.05

/** Distance in miles from a point to a straight segment, on a flat map around the point. */
function milesToSegment(
  [lat, lon]: [number, number],
  [lat1, lon1]: [number, number],
  [lat2, lon2]: [number, number],
): number {
  const scale = Math.cos((lat * Math.PI) / 180)
  const toXY = (pLat: number, pLon: number): [number, number] => [
    (pLon - lon) * scale * MILES_PER_DEGREE,
    (pLat - lat) * MILES_PER_DEGREE,
  ]
  const [ax, ay] = toXY(lat1, lon1)
  const [bx, by] = toXY(lat2, lon2)
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const along = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / lengthSquared))
  return Math.hypot(ax + along * dx, ay + along * dy)
}

/** Distance in miles from a point to the nearest part of any of the given lines. */
function milesFromLines(point: [number, number], lines: [number, number][][]): number {
  let nearest = Infinity
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      nearest = Math.min(nearest, milesToSegment(point, line[i - 1], line[i]))
    }
    if (line.length === 1) nearest = Math.min(nearest, distanceMiles(point, line[0]))
  }
  return nearest
}

/**
 * How far along a route its label should sit. Routes often share a road for part of
 * the way, and a label there looks as if it belongs to whichever line is drawn on top.
 * So the label goes on the stretch of the route that is furthest from the others, and
 * among stretches nearly as far, the one closest to the middle. A route that is shared
 * all the way keeps its default spot.
 */
export function labelFractionFor(route: Route, others: Route[]): number {
  const fallback = labelFraction(route.id)
  if (others.length === 0) return fallback
  const lines = others.map((other) => other.geometry)
  const candidates = CANDIDATE_FRACTIONS.map((fraction) => {
    const spot = pointAlong(route.geometry, fraction)
    return { fraction, away: milesFromLines([spot.lat, spot.lon], lines) }
  })
  const furthest = Math.max(...candidates.map((candidate) => candidate.away))
  if (furthest < SHARED_ROAD_MILES) return fallback
  return candidates
    .filter((candidate) => candidate.away >= furthest * 0.8)
    .reduce((best, candidate) =>
      Math.abs(candidate.fraction - 0.5) < Math.abs(best.fraction - 0.5) ? candidate : best,
    ).fraction
}
