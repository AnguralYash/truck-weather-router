import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { planResponse } from '../test/fixtures'
import { RouteCard } from './RouteCard'

const [recommended, risky, blocked] = planResponse.routes

describe('RouteCard', () => {
  it('shows distance, drive time, and average risk', () => {
    render(<RouteCard route={recommended} name="Route 2" color="#000" />)

    expect(screen.getByText('312 mi')).toBeInTheDocument()
    expect(screen.getByText('4 h 54 min')).toBeInTheDocument()
    expect(screen.getByText('1.0 / 5')).toBeInTheDocument()
    expect(screen.getByText('Recommended')).toBeInTheDocument()
  })

  it('describes the miles at each risk level', () => {
    render(<RouteCard route={risky} name="Route 1" color="#000" />)

    expect(screen.getByRole('img', { name: 'Miles by risk: Low 272 miles, High 25 miles' })).toBeInTheDocument()
    expect(screen.queryByText('Recommended')).not.toBeInTheDocument()
  })

  it('warns about No Travel conditions', () => {
    render(<RouteCard route={blocked} name="Route 3" color="#000" />)

    expect(screen.getByText(/includes no travel conditions/i)).toBeInTheDocument()
  })
})
