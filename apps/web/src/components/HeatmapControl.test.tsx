import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HeatmapControl } from './HeatmapControl'

function Harness({ start = 0, hours = 48 }: { start?: number; hours?: number }) {
  const [hour, setHour] = useState(start)
  const [playing, setPlaying] = useState(false)
  const [visible, setVisible] = useState(true)
  return (
    <HeatmapControl
      hours={hours}
      hour={hour}
      onHourChange={setHour}
      playing={playing}
      onPlayingChange={setPlaying}
      visible={visible}
      onVisibleChange={setVisible}
      departureUtc="2026-11-03T14:00:00+00:00"
      timezone="America/Chicago"
    />
  )
}

describe('HeatmapControl', () => {
  afterEach(() => vi.useRealTimers())

  it('starts at departure and shows the time in the origin zone', () => {
    render(<Harness />)

    expect(screen.getByText('At departure')).toBeInTheDocument()
    expect(screen.getByText(/Tue, 8:00\sAM CST/)).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Hours after departure' })).toHaveValue('0')
  })

  it('covers 0 to 48 hours and updates the label as the slider moves', () => {
    render(<Harness />)
    const slider = screen.getByRole('slider', { name: 'Hours after departure' })

    expect(slider).toHaveAttribute('min', '0')
    expect(slider).toHaveAttribute('max', '48')
    fireEvent.change(slider, { target: { value: '3' } })

    expect(screen.getByText('+3 h')).toBeInTheDocument()
    expect(screen.getByText(/Tue, 11:00\sAM CST/)).toBeInTheDocument()
  })

  it('credits the weather data wherever it is shown', () => {
    render(<Harness />)

    expect(screen.getByRole('link', { name: 'Weather data by Open-Meteo.com' })).toHaveAttribute(
      'href',
      'https://open-meteo.com/',
    )
  })

  it('crosses into the next day when the slider goes far enough', () => {
    render(<Harness start={30} />)

    expect(screen.getByText(/Wed, 2:00\sPM CST/)).toBeInTheDocument()
  })

  describe('playing', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))

    // Each hour's timer is scheduled after the previous render, so step like real time does.
    const seconds = async (count: number) => {
      for (let i = 0; i < count; i++) await act(() => vi.advanceTimersByTimeAsync(700))
    }

    it('advances one hour at a time and can be paused', async () => {
      render(<Harness />)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await user.click(screen.getByRole('button', { name: 'Play forecast' }))
      await seconds(2)
      expect(screen.getByText('+2 h')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Pause forecast' }))
      await seconds(4)
      expect(screen.getByText('+2 h')).toBeInTheDocument()
    })

    it('stops at the end and starts over from the beginning when played again', async () => {
      render(<Harness start={46} />)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await user.click(screen.getByRole('button', { name: 'Play forecast' }))
      await seconds(4)
      expect(screen.getByText('+48 h', { selector: 'strong' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Play forecast' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Play forecast' }))
      expect(screen.getByText('At departure')).toBeInTheDocument()
    })

    it('stops when the user drags the slider', async () => {
      render(<Harness />)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await user.click(screen.getByRole('button', { name: 'Play forecast' }))
      expect(screen.getByRole('button', { name: 'Pause forecast' })).toBeInTheDocument()
      fireEvent.change(screen.getByRole('slider', { name: 'Hours after departure' }), {
        target: { value: '10' },
      })

      expect(screen.getByRole('button', { name: 'Play forecast' })).toBeInTheDocument()
      expect(screen.getByText('+10 h')).toBeInTheDocument()
    })
  })

  it('disables the controls when the heatmap is hidden', async () => {
    render(<Harness />)

    await userEvent.setup().click(screen.getByRole('checkbox', { name: 'Show' }))

    expect(screen.getByRole('slider', { name: 'Hours after departure' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Play forecast' })).toBeDisabled()
  })
})
