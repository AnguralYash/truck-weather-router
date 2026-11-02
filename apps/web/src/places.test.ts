import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchPlaces, toPlaces } from './places'

const feature = (name: string, state: string, lon: number, lat: number, country = 'United States') => ({
  geometry: { coordinates: [lon, lat] as [number, number] },
  properties: { name, state, country },
})

describe('toPlaces', () => {
  it('labels places with their state and returns coordinates', () => {
    const places = toPlaces([feature('Dallas', 'Texas', -96.79, 32.77)])

    expect(places).toEqual([{ label: 'Dallas, Texas', lat: 32.77, lon: -96.79 }])
  })

  it('collapses duplicates with the same name and state', () => {
    const places = toPlaces([
      feature('Chicago', 'Illinois', -87.62, 41.87),
      feature('Chicago', 'Illinois', -87.63, 41.89),
      feature('Chicago Heights', 'Illinois', -87.63, 41.5),
    ])

    expect(places.map((p) => p.label)).toEqual(['Chicago, Illinois', 'Chicago Heights, Illinois'])
  })

  it('drops results outside the United States and nameless results', () => {
    const places = toPlaces([
      feature('Toronto', 'Ontario', -79.4, 43.7, 'Canada'),
      { geometry: { coordinates: [-90, 40] as [number, number] }, properties: { state: 'Illinois' } },
    ])

    expect(places).toEqual([])
  })

  it('returns at most five places', () => {
    const features = Array.from({ length: 9 }, (_, i) => feature(`Town ${i}`, 'Ohio', -80 - i, 40))

    expect(toPlaces(features)).toHaveLength(5)
  })
})

describe('searchPlaces', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('asks Photon for English results inside the US bounding box', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [feature('Denver', 'Colorado', -104.98, 39.73)] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const places = await searchPlaces('Denv')

    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.searchParams.get('q')).toBe('Denv')
    expect(url.searchParams.get('bbox')).toBe('-125,24,-66,50')
    expect(places[0].label).toBe('Denver, Colorado')
  })

  it('throws when the service fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await expect(searchPlaces('x')).rejects.toThrow('unavailable')
  })
})
