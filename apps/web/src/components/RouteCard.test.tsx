import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { planResponse } from '../test/fixtures'
import { RouteCard } from './RouteCard'

const [recommended, risky, blocked] = planResponse.routes

describe('RouteCard', () => {
  it('shows distance, drive time, and average risk', () => {
    render(<RouteCard route={recommended} name="Route 2" color="#000" selected onSelect={vi.fn()} />)

    expect(screen.getByText('312 mi')).toBeInTheDocument()
    expect(screen.getByText('4 h 54 min')).toBeInTheDocument()
    expect(screen.getByText('1.0 / 5')).toBeInTheDocument()
    expect(screen.getByText('Recommended')).toBeInTheDocument()
  })

  it('describes the miles at each risk level', () => {
    render(<RouteCard route={risky} name="Route 1" color="#000" selected={false} onSelect={vi.fn()} />)

    expect(screen.getByRole('img', { name: 'Miles by risk: Low 272 miles, High 25 miles' })).toBeInTheDocument()
    expect(screen.queryByText('Recommended')).not.toBeInTheDocument()
  })

  it('warns about No Travel conditions', () => {
    render(<RouteCard route={blocked} name="Route 3" color="#000" selected={false} onSelect={vi.fn()} />)

    expect(screen.getByText(/includes no travel conditions/i)).toBeInTheDocument()
  })

  it('reports which route is shown on the map and lets the user choose it', async () => {
    const onSelect = vi.fn()
    const { rerender } = render(
      <RouteCard route={risky} name="Route 1" color="#000" selected={false} onSelect={onSelect} />,
    )

    const button = screen.getByRole('button', { name: 'Route 1' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.setup().click(button)
    expect(onSelect).toHaveBeenCalledTimes(1)

    rerender(<RouteCard route={risky} name="Route 1" color="#000" selected onSelect={onSelect} />)
    expect(screen.getByRole('button', { name: 'Route 1' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('explains why the recommended route won, and why the others trail', () => {
    const { rerender } = render(
      <RouteCard route={recommended} name="Route 2" color="#000" selected onSelect={vi.fn()} />,
    )
    expect(screen.getByText('Why recommended:')).toBeInTheDocument()
    expect(screen.getByText(/Fewest High-risk miles: 0 mi vs 25 mi/)).toBeInTheDocument()

    rerender(<RouteCard route={risky} name="Route 1" color="#000" selected={false} onSelect={vi.fn()} />)
    expect(screen.queryByText('Why recommended:')).not.toBeInTheDocument()
    expect(screen.getByText(/25 mi of High risk/)).toBeInTheDocument()
  })

  it('shows no explanation when there is nothing to compare with', () => {
    render(
      <RouteCard
        route={{ ...recommended, ranking_note: null }}
        name="Route 1"
        color="#000"
        selected
        onSelect={vi.fn()}
      />,
    )

    expect(screen.queryByText(/Why recommended/)).not.toBeInTheDocument()
  })
})
