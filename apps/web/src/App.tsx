import { useEffect, useRef, useState } from 'react'
import { ApiError, planTrip } from './api'
import { Landing } from './components/Landing'
import { ResultsView } from './components/ResultsView'
import type { PlanRequest, PlanResponse } from './types'

const LOADING_STEPS = [
  'Finding truck routes…',
  'Checking the forecast along each route…',
  'Ranking routes by risk…',
]
const STEP_INTERVAL_MS = 1400

export default function App() {
  const [trip, setTrip] = useState<{ request: PlanRequest; result: PlanResponse } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(0)
  const latest = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!busy) return
    const timer = setInterval(
      () => setStep((current) => Math.min(current + 1, LOADING_STEPS.length - 1)),
      STEP_INTERVAL_MS,
    )
    return () => clearInterval(timer)
  }, [busy])

  const plan = async (request: PlanRequest): Promise<boolean> => {
    latest.current?.abort()
    const controller = new AbortController()
    latest.current = controller
    setStep(0)
    setBusy(true)
    setError(null)
    try {
      const result = await planTrip(request, controller.signal)
      setTrip({ request, result })
      return true
    } catch (failure) {
      if (controller.signal.aborted) return false
      setError(failure instanceof ApiError ? failure.message : 'Something went wrong.')
      return false
    } finally {
      if (latest.current === controller) setBusy(false)
    }
  }

  const busyLabel = LOADING_STEPS[step]

  return trip ? (
    <ResultsView
      request={trip.request}
      result={trip.result}
      busy={busy}
      busyLabel={busyLabel}
      error={error}
      onPlan={plan}
    />
  ) : (
    <Landing busy={busy} busyLabel={busyLabel} error={error} onPlan={plan} />
  )
}
