import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DateTimePicker } from './DateTimePicker'

function Harness({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState('2026-11-03T08:00')
  return (
    <>
      <span id="label">Departure</span>
      <DateTimePicker
        value={value}
        labelledBy="label"
        onChange={(next) => {
          setValue(next)
          onChange(next)
        }}
      />
      <button type="button">Outside</button>
    </>
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 2, 12, 0))
})

afterEach(() => vi.useRealTimers())

describe('DateTimePicker', () => {
  it('shows the departure in words', () => {
    render(<Harness onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: /Departure Tue, Nov 3, 8:00\sAM/ })).toBeInTheDocument()
  })

  it('changes the day and keeps the time', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /Departure/ }))
    await user.click(screen.getByRole('button', { name: /November 5th/ }))

    expect(onChange).toHaveBeenLastCalledWith('2026-11-05T08:00')
  })

  it('changes the time and keeps the day', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /Departure/ }))
    await user.click(screen.getByRole('option', { name: '2:30 PM' }))

    expect(onChange).toHaveBeenLastCalledWith('2026-11-03T14:30')
  })

  it('does not allow days in the past or beyond the forecast', async () => {
    render(<Harness onChange={vi.fn()} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /Departure/ }))

    expect(screen.getByRole('button', { name: /November 1st/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /November 15th/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /November 16th/ })).toBeDisabled()
  })

  it('closes on Escape and on an outside click', async () => {
    render(<Harness onChange={vi.fn()} />)
    const user = userEvent.setup()
    const trigger = screen.getByRole('button', { name: /Departure/ })

    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'Outside' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
