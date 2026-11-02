import { formatDuration, formatMiles } from '../format'
import type { Route } from '../types'
import { RiskBar } from './RiskBar'

interface Props {
  route: Route
  name: string
  color: string
  selected: boolean
  onSelect: () => void
}

export function RouteCard({ route, name, color, selected, onSelect }: Props) {
  const { summary } = route
  const classes = ['route-card', route.recommended && 'recommended', selected && 'selected']
  return (
    <article className={classes.filter(Boolean).join(' ')}>
      <header>
        <span className="swatch" style={{ background: color }} aria-hidden="true" />
        <h3>
          <button type="button" className="route-select" aria-pressed={selected} onClick={onSelect}>
            {name}
          </button>
        </h3>
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
      {route.ranking_note && (
        <p className="ranking-note">
          {route.recommended && <strong>Why recommended: </strong>}
          {route.ranking_note}
        </p>
      )}
      {summary.has_no_travel && (
        <p className="warning">Includes No Travel conditions. Avoid unless no other option.</p>
      )}
    </article>
  )
}
