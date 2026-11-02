import { RISK_LEVELS } from '../risk'
import type { RiskName } from '../types'

export function RiskBar({ milesByLevel }: { milesByLevel: Record<RiskName, number> }) {
  const total = RISK_LEVELS.reduce((sum, risk) => sum + milesByLevel[risk.name], 0)
  const present = RISK_LEVELS.filter((risk) => milesByLevel[risk.name] > 0)
  const description = present
    .map((risk) => `${risk.label} ${Math.round(milesByLevel[risk.name])} miles`)
    .join(', ')

  return (
    <div className="risk-bar">
      <div className="risk-bar-track" role="img" aria-label={`Miles by risk: ${description}`}>
        {present.map((risk) => (
          <span
            key={risk.name}
            style={{
              width: `${(milesByLevel[risk.name] / total) * 100}%`,
              background: risk.color,
            }}
          />
        ))}
      </div>
      <ul className="risk-bar-legend" aria-hidden="true">
        {present.map((risk) => (
          <li key={risk.name}>
            <i style={{ background: risk.color }} />
            {risk.label} {Math.round(milesByLevel[risk.name])} mi
          </li>
        ))}
      </ul>
    </div>
  )
}
