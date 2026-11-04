import { Suspense, lazy, useState } from 'react'
import { formatDeparture } from '../datetime'
import { formatPounds } from '../format'
import { routeColor, routeNumber } from '../risk'
import type { PlanRequest, PlanResponse } from '../types'
import { BrandMark } from './BrandMark'
import { RouteCard } from './RouteCard'
import { HeatmapControl } from './HeatmapControl'
import { TripForm } from './TripForm'

const MapView = lazy(() => import('./MapView').then((module) => ({ default: module.MapView })))

interface Props {
  request: PlanRequest
  result: PlanResponse
  busy: boolean
  busyLabel: string
  error: string | null
  onPlan: (request: PlanRequest) => Promise<boolean>
}

export function ResultsView({ request, result, busy, busyLabel, error, onPlan }: Props) {
  const [editing, setEditing] = useState(false)
  const [hour, setHour] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [heatVisible, setHeatVisible] = useState(true)
  const [choice, setChoice] = useState<{ result: PlanResponse; id: string } | null>(null)
  // A new result starts again on its recommended route.
  const selectedId = choice?.result === result ? choice.id : result.recommended_route_id
  const select = (id: string) => setChoice({ result, id })

  const replan = async (next: PlanRequest) => {
    if (await onPlan(next)) {
      setEditing(false)
      setHour(0)
      setPlaying(false)
    }
  }

  return (
    <div className="results">
      <aside className="panel">
        <header className="panel-header">
          <BrandMark compact />
        </header>
        <div className="panel-body">
          {editing ? (
            <section className="trip-edit" aria-label="Edit trip">
              <TripForm
                initial={request}
                busy={busy}
                busyLabel={busyLabel}
                submitLabel="Update routes"
                onSubmit={replan}
              />
              <button type="button" className="link-button" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </section>
          ) : (
            <section className="trip-summary" aria-label="Trip">
              <p className="stop">
                <span className="marker">A</span>
                {request.origin.label}
              </p>
              <p className="stop">
                <span className="marker">B</span>
                {request.destination.label}
              </p>
              <p className="trip-meta">
                {formatDeparture(request.departure)} · {formatPounds(request.loadLb)} · checks
                every {request.spacingMiles} mi
              </p>
              <button type="button" className="secondary" onClick={() => setEditing(true)}>
                Edit trip
              </button>
            </section>
          )}

          {error && (
            <p role="alert" className="banner error-banner">
              {error}
            </p>
          )}
          {result.notice && <p className="banner">{result.notice}</p>}

          <h2 className="section-title">Routes</h2>
          <div className="route-list">
            {result.routes.map((route, order) => (
              <div key={route.id} className="route-enter" style={{ animationDelay: `${order * 0.07}s` }}>
                <RouteCard
                  route={route}
                  name={`Route ${routeNumber(route.id)}`}
                  color={routeColor(route.id)}
                  selected={route.id === selectedId}
                  onSelect={() => select(route.id)}
                />
              </div>
            ))}
          </div>
        </div>
      </aside>
      <main className="map-area" aria-label="Map">
        <Suspense fallback={<p className="map-empty">Loading map…</p>}>
          <MapView
            routes={result.routes}
            selectedId={selectedId}
            timezone={result.timezone}
            heatmap={result.heatmap}
            hour={hour}
            heatVisible={heatVisible}
            onSelect={select}
          />
        </Suspense>
        <HeatmapControl
          hours={result.heatmap.hours}
          hour={hour}
          onHourChange={setHour}
          playing={playing}
          onPlayingChange={setPlaying}
          visible={heatVisible}
          onVisibleChange={(show) => {
            setHeatVisible(show)
            if (!show) setPlaying(false)
          }}
          departureUtc={result.departure_utc}
          timezone={result.timezone}
        />
      </main>
    </div>
  )
}
