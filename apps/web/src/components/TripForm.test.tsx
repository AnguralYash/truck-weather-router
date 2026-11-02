import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as places from '../places'
import { TripForm } from './TripForm'

const CHICAGO = { label: 'Chicago, Illinois', lat: 41.88, lon: -87.63 }
const ST_LOUIS = { label: 'St. Louis, Missouri', lat: 38.63, lon: -90.2 }

beforeEach(() => {
  vi.spyOn(places, 'searchPlaces').mockImplementation(async (query) =>
    query.toLowerCase().startsWith('chi') ? [CHICAGO] : [ST_LOUIS],
  )
})

async function pick(field: string, typed: string, option: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(field), typed)
  await user.click(await screen.findByRole('option', { name: option }, { timeout: 3000 }))
}

describe('TripForm', () => {
  it('shows what is missing when submitted empty and sends nothing', async () => {
    const onSubmit = vi.fn()
    render(<TripForm busy={false} onSubmit={onSubmit} />)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Plan trip' }))

    expect(screen.getByText(/choose a starting place/i)).toBeInTheDocument()
    expect(screen.getByText(/choose a destination/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits the chosen places, departure, load, and spacing', async () => {
    const onSubmit = vi.fn()
    render(<TripForm busy={false} onSubmit={onSubmit} />)
    const user = userEvent.setup()

    await pick('From', 'chic', 'Chicago, Illinois')
    await pick('To', 'st lo', 'St. Louis, Missouri')
    await user.clear(screen.getByLabelText('Load weight (lb)'))
    await user.type(screen.getByLabelText('Load weight (lb)'), '45000')
    await user.click(screen.getByLabelText('50 mi'))
    await user.click(screen.getByRole('button', { name: 'Plan trip' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      origin: CHICAGO,
      destination: ST_LOUIS,
      loadLb: 45000,
      spacingMiles: 50,
    })
    expect(onSubmit.mock.calls[0][0].departure).toMatch(/^\d{4}-\d{2}-\d{2}T08:00$/)
  })

  it('rejects a load over the legal limit', async () => {
    const onSubmit = vi.fn()
    render(<TripForm busy={false} onSubmit={onSubmit} />)
    const user = userEvent.setup()
    await pick('From', 'chic', 'Chicago, Illinois')
    await pick('To', 'st lo', 'St. Louis, Missouri')

    await user.clear(screen.getByLabelText('Load weight (lb)'))
    await user.type(screen.getByLabelText('Load weight (lb)'), '90000')
    await user.click(screen.getByRole('button', { name: 'Plan trip' }))

    expect(screen.getByText(/between 1 and 80,000 lb/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('forgets a chosen place once the text is edited', async () => {
    const onSubmit = vi.fn()
    render(<TripForm busy={false} onSubmit={onSubmit} />)
    const user = userEvent.setup()
    await pick('From', 'chic', 'Chicago, Illinois')
    await pick('To', 'st lo', 'St. Louis, Missouri')

    await user.type(screen.getByLabelText('From'), 'x')
    await user.click(screen.getByRole('button', { name: 'Plan trip' }))

    expect(screen.getByText(/choose a starting place/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('disables the button while planning', () => {
    render(<TripForm busy onSubmit={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Planning…' })).toBeDisabled()
  })

  it('does not search for fewer than three characters', async () => {
    render(<TripForm busy={false} onSubmit={vi.fn()} />)

    await userEvent.setup().type(screen.getByLabelText('From'), 'ch')
    await new Promise((resolve) => setTimeout(resolve, 500))

    await waitFor(() => expect(places.searchPlaces).not.toHaveBeenCalled())
  })
})
