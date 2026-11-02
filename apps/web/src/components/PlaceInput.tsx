import { useEffect, useId, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { searchPlaces } from '../places'
import type { Place } from '../types'

const MIN_CHARS = 3
const DEBOUNCE_MS = 300

interface Props {
  label: string
  marker: string
  value: Place | null
  onChange: (place: Place | null) => void
  error?: string
}

type Status = 'idle' | 'loading' | 'empty' | 'error'

export function PlaceInput({ label, marker, value, onChange, error }: Props) {
  const id = useId()
  const listId = `${id}-list`
  const [text, setText] = useState(value?.label ?? '')
  const [options, setOptions] = useState<Place[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [status, setStatus] = useState<Status>('idle')

  const query = text.trim()
  const searching = !value && query.length >= MIN_CHARS

  useEffect(() => {
    if (!searching) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setStatus('loading')
      try {
        const places = await searchPlaces(query, controller.signal)
        setOptions(places)
        setActive(-1)
        setStatus(places.length ? 'idle' : 'empty')
      } catch {
        if (!controller.signal.aborted) setStatus('error')
      }
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, searching])

  const choose = (place: Place) => {
    setText(place.label)
    setOpen(false)
    onChange(place)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((index) => Math.min(index + 1, options.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter' && open && active >= 0) {
      event.preventDefault()
      choose(options[active])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const showList = open && searching && options.length > 0
  const message = !searching
    ? null
    : status === 'loading'
      ? 'Searching…'
      : status === 'empty'
        ? 'No matching places in the US.'
        : status === 'error'
          ? 'Place search is unavailable. Try again.'
          : null

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="place">
        <span className="marker" aria-hidden="true">
          {marker}
        </span>
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-option-${active}` : undefined}
          aria-invalid={Boolean(error)}
          autoComplete="off"
          placeholder="City or address"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setOpen(true)
            if (value) onChange(null)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {showList && (
          <ul id={listId} role="listbox" className="suggestions">
            {options.map((place, index) => (
              <li
                key={`${place.label}-${place.lat}`}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={index === active}
                className={index === active ? 'active' : undefined}
                onMouseDown={(event) => {
                  event.preventDefault()
                  choose(place)
                }}
              >
                {place.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {message && <p className="hint">{message}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
