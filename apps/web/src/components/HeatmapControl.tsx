import { useEffect, useId } from 'react'
import { formatEta } from '../datetime'

interface Props {
  hours: number
  hour: number
  onHourChange: (hour: number) => void
  playing: boolean
  onPlayingChange: (playing: boolean) => void
  visible: boolean
  onVisibleChange: (visible: boolean) => void
  departureUtc: string
  timezone: string
}

const STEP_MS = 650
const TICKS = [0, 12, 24, 36, 48]

export function HeatmapControl({
  hours,
  hour,
  onHourChange,
  playing,
  onPlayingChange,
  visible,
  onVisibleChange,
  departureUtc,
  timezone,
}: Props) {
  const id = useId()

  // While playing, advance one hour at a time and stop at the end.
  useEffect(() => {
    if (!playing) return
    if (hour >= hours) {
      onPlayingChange(false)
      return
    }
    const timer = setTimeout(() => onHourChange(hour + 1), STEP_MS)
    return () => clearTimeout(timer)
  }, [playing, hour, hours, onHourChange, onPlayingChange])

  const when = new Date(Date.parse(departureUtc) + hour * 3_600_000).toISOString()
  const label = formatEta(when, timezone)

  const togglePlay = () => {
    if (!playing && hour >= hours) onHourChange(0)
    onPlayingChange(!playing)
  }

  return (
    <section className="heat-control" aria-label="Weather forecast heatmap">
      <div className="heat-head">
        <h2>Weather risk heatmap</h2>
        <label className="switch">
          <input
            type="checkbox"
            checked={visible}
            onChange={(event) => onVisibleChange(event.target.checked)}
          />
          <span>Show</span>
        </label>
      </div>

      <div className="heat-row">
        <button
          type="button"
          className="play"
          onClick={togglePlay}
          disabled={!visible}
          aria-label={playing ? 'Pause forecast' : 'Play forecast'}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          )}
        </button>
        <div className="heat-slider">
          <input
            id={id}
            type="range"
            min={0}
            max={hours}
            step={1}
            value={hour}
            disabled={!visible}
            aria-label="Hours after departure"
            aria-valuetext={`${hour} hours after departure, ${label}`}
            onChange={(event) => {
              onPlayingChange(false)
              onHourChange(Number(event.target.value))
            }}
          />
          <div className="ticks" aria-hidden="true">
            {TICKS.filter((tick) => tick <= hours).map((tick) => (
              <span key={tick}>{tick === 0 ? 'Depart' : `+${tick} h`}</span>
            ))}
          </div>
        </div>
      </div>

      <p className="heat-time" aria-live="polite">
        <strong>{hour === 0 ? 'At departure' : `+${hour} h`}</strong> · {label}
      </p>
      <p className="heat-hint">
        Colors show the risk at this hour. Dots show the risk when you arrive.
      </p>
      <p className="heat-credit">
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
          Weather data by Open-Meteo.com
        </a>
      </p>
    </section>
  )
}
