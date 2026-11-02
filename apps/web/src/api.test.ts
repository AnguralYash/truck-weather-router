import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, planTrip } from './api'
import type { PlanRequest } from './types'

const request: PlanRequest = {
  origin: { label: 'Chicago, Illinois', lat: 41.88, lon: -87.63 },
  destination: { label: 'St. Louis, Missouri', lat: 38.63, lon: -90.2 },
  departure: '2026-11-03T12:00',
  loadLb: 42000,
  spacingMiles: 25,
}

afterEach(() => vi.unstubAllGlobals())

describe('planTrip', () => {
  it('posts the trip in the shape the API expects', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ routes: [] }) })
    vi.stubGlobal('fetch', fetchMock)

    await planTrip(request)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/plan')
    expect(JSON.parse(init.body as string)).toEqual({
      origin: { lat: 41.88, lon: -87.63 },
      destination: { lat: 38.63, lon: -90.2 },
      departure: '2026-11-03T12:00',
      load_lb: 42000,
      spacing_miles: 25,
    })
  })

  it('turns an API error into an ApiError with its code and message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: { code: 'trip_too_long', message: 'Too far.' } }),
      }),
    )

    await expect(planTrip(request)).rejects.toMatchObject({ code: 'trip_too_long', message: 'Too far.' })
  })

  it('reports a network failure as a friendly error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const failure = planTrip(request)

    await expect(failure).rejects.toBeInstanceOf(ApiError)
    await expect(failure).rejects.toMatchObject({ code: 'network' })
  })

  it('falls back to a generic message when the error body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => Promise.reject(new Error('bad')) }),
    )

    await expect(planTrip(request)).rejects.toMatchObject({ code: 'server_error' })
  })
})
