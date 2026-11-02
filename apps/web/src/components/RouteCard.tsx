import { formatDuration, formatMiles } from '../format'
import type { Route } from '../types'
import { RiskBar } from './RiskBar'

interface Props {
  route: Route
  name: string
  color: string
}

export function RouteCard({ route, name, color }: Props) {
  const { summary } = route
  return (
    <article className={route.recommended ? 'route-card recommended' : 'route-card'}>
      <header>
        <span className="swatch" style={{ background: color }} aria-hidden="true" />
        <h3>{name}</h3>
        {route.recommended && <span className="badge">Recommended</span>}
      </header>
      <dl className="route-stats">
        <div>
          <dt>Distance</dt>
          <dd>{formatMiles(route.distance_miles)}</dd>
        </div>
        <div>
          <dt>Drive time</dt>
          <dd>{formatDuration(route.duration_s)}</dd>
        </div>
        <div>
          <dt>Avg. risk</dt>
          <dd>{summary.average_risk.toFixed(1)} / 5</dd>
        </div>
      </dl>
      <RiskBar milesByLevel={summary.miles_by_level} />
      {summary.has_no_travel && (
        <p className="warning">Includes No Travel conditions. Avoid unless no other option.</p>
      )}
    </article>
  )
}
