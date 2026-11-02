import { useState } from 'react'
import { formatDeparture } from '../datetime'
import { formatPounds } from '../format'
import { routeColor, routeNumber } from '../risk'
import type { PlanRequest, PlanResponse } from '../types'
import { BrandMark } from './BrandMark'
import { RouteCard } from './RouteCard'
import { TripForm } from './TripForm'

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

  const replan = async (next: PlanRequest) => {
    if (await onPlan(next)) setEditing(false)
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
                />
              </div>
            ))}
          </div>
        </div>
      </aside>
      <main className="map-area" aria-label="Map">
        <p className="map-empty">The map is added in the next step.</p>
      </main>
    </div>
  )
}
