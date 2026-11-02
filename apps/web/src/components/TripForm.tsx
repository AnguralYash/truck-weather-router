import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { defaultDeparture } from '../datetime'
import type { Place, PlanRequest } from '../types'
import { DateTimePicker } from './DateTimePicker'
import { PlaceInput } from './PlaceInput'

const MAX_LOAD_LB = 80_000
const SPACINGS = [10, 25, 50] as const

interface Props {
  initial?: PlanRequest
  busy: boolean
  busyLabel?: string
  submitLabel?: string
  onSubmit: (request: PlanRequest) => void
}

export function TripForm({
  initial,
  busy,
  busyLabel = 'Planning…',
  submitLabel = 'Plan trip',
  onSubmit,
}: Props) {
  const departureLabel = useId()
  const [origin, setOrigin] = useState<Place | null>(initial?.origin ?? null)
  const [destination, setDestination] = useState<Place | null>(initial?.destination ?? null)
  const [departure, setDeparture] = useState(() => initial?.departure ?? defaultDeparture())
  const [load, setLoad] = useState(String(initial?.loadLb ?? 40000))
  const [spacing, setSpacing] = useState<(typeof SPACINGS)[number]>(initial?.spacingMiles ?? 25)
  const [submitted, setSubmitted] = useState(false)

  const loadLb = Number(load)
  const loadError =
    load.trim() === '' || !Number.isFinite(loadLb) || loadLb < 1 || loadLb > MAX_LOAD_LB
      ? `Enter a weight between 1 and ${MAX_LOAD_LB.toLocaleString()} lb.`
      : undefined
  const errors = {
    origin: origin ? undefined : 'Choose a starting place from the suggestions.',
    destination: destination ? undefined : 'Choose a destination from the suggestions.',
    load: loadError,
  }
  const show = (message?: string) => (submitted ? message : undefined)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (!origin || !destination || loadError) return
    onSubmit({ origin, destination, departure, loadLb, spacingMiles: spacing })
  }

  return (
    <form className="trip-form" onSubmit={handleSubmit} noValidate>
      <div className="route-fields">
        <PlaceInput
          label="From"
          marker="A"
          value={origin}
          onChange={setOrigin}
          error={show(errors.origin)}
        />
        <PlaceInput
          label="To"
          marker="B"
          value={destination}
          onChange={setDestination}
          error={show(errors.destination)}
        />
      </div>

      <div className="field">
        <span className="field-label" id={departureLabel}>
          Departure (local time at origin)
        </span>
        <DateTimePicker value={departure} onChange={setDeparture} labelledBy={departureLabel} />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="load">Load weight (lb)</label>
          <input
            id="load"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_LOAD_LB}
            step={500}
            value={load}
            onChange={(event) => setLoad(event.target.value)}
            aria-invalid={Boolean(show(errors.load))}
          />
          {show(errors.load) && <p className="error">{errors.load}</p>}
        </div>

        <fieldset className="field">
          <legend>Weather check every</legend>
          <div className="segmented">
            {SPACINGS.map((miles) => (
              <label key={miles} className={miles === spacing ? 'selected' : undefined}>
                <input
                  type="radio"
                  name="spacing"
                  value={miles}
                  checked={miles === spacing}
                  onChange={() => setSpacing(miles)}
                />
                {miles} mi
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <button type="submit" className="primary" disabled={busy} aria-live="polite">
        {busy && <span className="spinner" aria-hidden="true" />}
        {busy ? busyLabel : submitLabel}
      </button>
    </form>
  )
}
