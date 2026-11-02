import type { Place } from './types'

const PHOTON_URL = 'https://photon.komoot.io/api/'
/** Contiguous US: west, south, east, north. */
const US_BOUNDING_BOX = '-125,24,-66,50'
const MAX_RESULTS = 5

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    name?: string
    street?: string
    city?: string
    state?: string
    country?: string
  }
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({
    q: query,
    limit: '10',
    lang: 'en',
    bbox: US_BOUNDING_BOX,
  })
  const response = await fetch(`${PHOTON_URL}?${params}`, { signal })
  if (!response.ok) throw new Error('Place search is unavailable.')
  const data = (await response.json()) as { features: PhotonFeature[] }
  return toPlaces(data.features)
}

export function toPlaces(features: PhotonFeature[]): Place[] {
  const seen = new Set<string>()
  const places: Place[] = []
  for (const { geometry, properties } of features) {
    if (properties.country && properties.country !== 'United States') continue
    const name = properties.name ?? properties.street
    if (!name) continue
    const label = [name, properties.state].filter(Boolean).join(', ')
    if (seen.has(label)) continue
    seen.add(label)
    const [lon, lat] = geometry.coordinates
    places.push({ label, lat, lon })
    if (places.length === MAX_RESULTS) break
  }
  return places
}
