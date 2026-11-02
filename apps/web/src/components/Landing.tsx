import type { PlanRequest } from '../types'
import { BrandMark } from './BrandMark'
import { TripForm } from './TripForm'

interface Props {
  busy: boolean
  busyLabel: string
  error: string | null
  onPlan: (request: PlanRequest) => void
}

const STEPS = [
  {
    title: 'Compare truck routes',
    text: 'Up to three truck-legal routes between your start and destination.',
  },
  {
    title: 'Check weather on arrival',
    text: 'Wind, rain, and snow forecast for the hour you reach each stretch of road.',
  },
  {
    title: 'Get the safest pick',
    text: 'Risk rated for your load weight, with the safest reasonable route recommended.',
  },
]

export function Landing({ busy, busyLabel, error, onPlan }: Props) {
  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-inner">
          <BrandMark />
          <h1>Pick the safest route before you roll.</h1>
          <p className="lede">
            Truck Weather Router checks the forecast along every route at the time you will
            actually be there, and weighs it against your load.
          </p>
          <ol className="steps">
            {STEPS.map((step, index) => (
              <li key={step.title} style={{ animationDelay: `${0.15 + index * 0.08}s` }}>
                <span className="step-number">{index + 1}</span>
                <div>
                  <h2>{step.title}</h2>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="form-card" aria-labelledby="plan-heading">
        <h2 id="plan-heading">Plan a trip</h2>
        <TripForm busy={busy} busyLabel={busyLabel} onSubmit={onPlan} />
        {error && (
          <p role="alert" className="banner error-banner">
            {error}
          </p>
        )}
      </section>

      <footer className="credits">
        Routing by Valhalla · Weather by Open-Meteo · Search by Photon · Map data ©
        OpenStreetMap contributors
      </footer>
    </div>
  )
}
