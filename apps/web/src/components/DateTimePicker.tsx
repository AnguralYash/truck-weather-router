import { useEffect, useId, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import {
  TIME_SLOTS,
  bookableDays,
  formatDeparture,
  parseDeparture,
  toDeparture,
} from '../datetime'

interface Props {
  value: string
  onChange: (value: string) => void
  labelledBy: string
}

export function DateTimePicker({ value, onChange, labelledBy }: Props) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const { date, time } = parseDeparture(value)

  const [{ first: today, last: lastDay }] = useState(() => bookableDays())

  useEffect(() => {
    if (!open) return
    root.current
      ?.querySelector('.datetime-popover')
      ?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
    const onPointerDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="datetime" ref={root}>
      <button
        type="button"
        className="datetime-trigger"
        aria-labelledby={`${labelledBy} ${id}-value`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        <span id={`${id}-value`}>{formatDeparture(value)}</span>
      </button>
      {open && (
        <div className="datetime-popover" role="dialog" aria-label="Departure date and time">
          <DayPicker
            mode="single"
            required
            selected={date}
            onSelect={(day) => onChange(toDeparture(day, time))}
            defaultMonth={date}
            startMonth={today}
            endMonth={lastDay}
            disabled={[{ before: today }, { after: lastDay }]}
          />
          <TimeList value={time} onChange={(slot) => onChange(toDeparture(date, slot))} />
        </div>
      )}
    </div>
  )
}

function TimeList({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = list.current
    const selected = container?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!container || !selected) return
    const offset =
      selected.getBoundingClientRect().top - container.getBoundingClientRect().top
    container.scrollTop += offset - (container.clientHeight - selected.offsetHeight) / 2
  }, [])

  return (
    <div className="time-list" role="listbox" aria-label="Time" ref={list}>
      {TIME_SLOTS.map((slot) => (
        <button
          key={slot.value}
          type="button"
          role="option"
          aria-selected={slot.value === value}
          onClick={() => onChange(slot.value)}
        >
          {slot.label}
        </button>
      ))}
    </div>
  )
}
