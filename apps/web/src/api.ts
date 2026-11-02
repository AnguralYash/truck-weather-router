import type { PlanRequest, PlanResponse } from './types'

export class ApiError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export async function planTrip(
  request: PlanRequest,
  signal?: AbortSignal,
): Promise<PlanResponse> {
  let response: Response
  try {
    response = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        origin: { lat: request.origin.lat, lon: request.origin.lon },
        destination: { lat: request.destination.lat, lon: request.destination.lon },
        departure: request.departure,
        load_lb: request.loadLb,
        spacing_miles: request.spacingMiles,
      }),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('network', 'Could not reach the server. Check your connection.')
  }

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const failure = (body as { error?: { code?: string; message?: string } } | null)?.error
    throw new ApiError(
      failure?.code ?? 'server_error',
      failure?.message ?? 'Something went wrong while planning the trip.',
    )
  }
  return body as PlanResponse
}
