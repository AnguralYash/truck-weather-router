# Product and engineering decisions

This file records the assumptions and decisions that shape the app, and why
they were made. The brief leaves several points open; each is resolved here.

## Scope

- **US trips only.** The risk table uses US units (mph, inches per hour). The
  routing and weather providers work worldwide, but the thresholds are not
  defined for other regions.
- **Departure must be between now and the forecast range.** Past or
  out-of-range departures are rejected with a clear message instead of
  producing partial weather data.

## Risk model

- **Checkpoint spacing is chosen by the user** from 10, 25, or 50 miles,
  defaulting to 25.
- **Weather is sampled at the truck's estimated arrival time** at each
  checkpoint, not at departure time.
- **A checkpoint's risk is the worst of its wind, rain, and snow levels**,
  after the load-weight rules are applied.
- **Risk levels are scored 1-5** (Low, Moderate, High, Severe, No Travel) to
  compute an average.
- **Each checkpoint covers the stretch halfway to its neighbours.** These
  distances give the miles at each risk level and the mile-weighted average.

## Recommendation

- **Routes are ranked in strict order:** fewest Severe miles, then fewest High
  miles, then lowest average risk, then shortest travel time. This follows the
  brief's preference list exactly.
- **A route containing No Travel is ranked last and flagged.** It is still
  shown on the map, and is never recommended over a route without No Travel. If
  every route contains No Travel, the least bad is recommended with a warning.

## Heatmap

- **The 0-48 hour slider counts from the departure time.**

## Architecture

- **React (Vite) and Django live in one monorepo on Vercel**, with the same
  layout as a previous project: `apps/web`, `apps/api`, and a `vercel.json`
  that routes `/api/*` to the backend.
- **Weather:** Open-Meteo (no key, batched requests).
- **Routing and geocoding:** OpenRouteService, pending a test that it returns
  three alternatives on long trips. HERE Routing is the fallback.
