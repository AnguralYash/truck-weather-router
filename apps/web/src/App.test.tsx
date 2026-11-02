import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as api from './api'
import * as places from './places'
import { planResponse } from './test/fixtures'

const CHICAGO = { label: 'Chicago, Illinois', lat: 41.88, lon: -87.63 }
const ST_LOUIS = { label: 'St. Louis, Missouri', lat: 38.63, lon: -90.2 }

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(places, 'searchPlaces').mockImplementation(async (query) =>
    query.toLowerCase().startsWith('chi') ? [CHICAGO] : [ST_LOUIS],
  )
})

async function fillAndSubmit() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('From'), 'chic')
  await user.click(await screen.findByRole('option', { name: CHICAGO.label }, { timeout: 3000 }))
  await user.type(screen.getByLabelText('To'), 'st lo')
  await user.click(await screen.findByRole('option', { name: ST_LOUIS.label }, { timeout: 3000 }))
  await user.click(screen.getByRole('button', { name: 'Plan trip' }))
  return user
}

describe('App', () => {
  it('explains the product before a trip is planned', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/safest route/i)
    expect(screen.getByText('Check weather on arrival')).toBeInTheDocument()
  })

  it('moves to the results with routes in rank order', async () => {
    vi.spyOn(api, 'planTrip').mockResolvedValue(planResponse)
    render(<App />)

    await fillAndSubmit()

    expect(await screen.findByRole('heading', { name: 'Routes' })).toBeInTheDocument()
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(names).toEqual(['Route 2', 'Route 1', 'Route 3'])
    expect(screen.getByText('Chicago, Illinois')).toBeInTheDocument()
  })

  it('keeps the user on the form when planning fails', async () => {
    vi.spyOn(api, 'planTrip').mockRejectedValue(
      new api.ApiError('trip_too_long', 'This trip is too long.'),
    )
    render(<App />)

    await fillAndSubmit()

    expect(await screen.findByRole('alert')).toHaveTextContent('This trip is too long.')
    expect(screen.getByRole('heading', { name: 'Plan a trip' })).toBeInTheDocument()
  })

  it('lets the user edit the trip from the results', async () => {
    vi.spyOn(api, 'planTrip').mockResolvedValue(planResponse)
    render(<App />)
    const user = await fillAndSubmit()

    await user.click(await screen.findByRole('button', { name: 'Edit trip' }))

    expect(screen.getByLabelText('From')).toHaveValue('Chicago, Illinois')
    expect(screen.getByRole('button', { name: 'Update routes' })).toBeInTheDocument()
  })
})
