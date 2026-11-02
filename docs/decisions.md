# Product and engineering decisions

This file records the assumptions and decisions that shape the app, and why
they were made. The brief leaves several points open; each is resolved here.

## Scope

- **US trips only.** The risk table uses US units (mph, inches per hour). The
  routing and weather providers work worldwide, but the thresholds are not
  defined for other regions.
- **The departure time is in the origin's local time.** The US spans several
  time zones and drivers plan in the time of the place they leave from. The form
  labels the zone, and the API converts the time to UTC before sampling weather.
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
- **Boundary values go to the higher level.** The brief's table overlaps at
  some values (rain "0.10-0.25" and "0.25-0.50"), so rain at 0.25 in/hr is High
  and at 0.50 is Severe. No Travel needs strictly more than 1.00 in/hr of rain
  or 3.0 in/hr of snow, and wind at or above 55 mph, as written in the brief.
- **Load rules only raise a level, never lower it.** Wind of 45 mph or more
  with a load over 30,000 lb is No Travel. Wind of 35 mph or more with a load
  over 40,000 lb is at least Severe.
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
- **The heatmap shows risk level**, using the same thresholds, load rules, and
  colors as the route scoring, so the map and the recommendation agree.
- **The forecast for each heatmap point is fetched once**, for all 48 hours.
  Moving the slider only changes which hour is displayed, so it never waits on
  the network.

## Architecture

- **React (Vite) and Django live in one monorepo on Vercel**, with the same
  layout as a previous project: `apps/web`, `apps/api`, and a `vercel.json`
  that routes `/api/*` to the backend.
- **Weather:** Open-Meteo (no key, batched requests).
- **Routing:** the public Valhalla server (`valhalla1.openstreetmap.de`) with
  its `truck` costing and the load weight passed in. It returned three
  alternatives on medium and long trips and needs no key or billing details.
  Alternatives considered and rejected:
  - OpenRouteService refuses alternative routes above 100 km, which rules out
    most truck trips.
  - OSRM's public server returned only one or two routes on every trip tested.
  - HERE Routing needs billing details and can bill automatically past its free
    allowance, which is not worth the risk for a take-home project.
- **Place search:** Photon (`photon.komoot.io`), restricted to a bounding box
  around the contiguous US, so the form can suggest places as the user types.
  Requests are debounced to respect the public server's fair-use limits, and
  duplicate results (same name and state) are collapsed. Alaska and Hawaii are
  out of scope.
- **Map:** MapLibre GL with the OpenFreeMap "liberty" style, which needs no key.
  It is a free community service; if it were unavailable the background would
  be blank, but routes, checkpoints, and the heatmap would still draw.
- **Known routing limits:** the public Valhalla server rejects trips over about
  1,500 km, and may return fewer than three routes on short trips. The app
  shows a clear message for the first case and displays however many routes
  come back for the second. It is a shared demo server meant for light use.

## Planner and API

- **Arrival times assume a constant average speed** over each route, using the
  route's total duration from the routing service. Arrival times are reported
  in UTC and shown in the origin's time zone.
- **Load weight affects weather risk only.** Routes come from the standard
  truck profile with default vehicle dimensions; they are not checked against
  weight limits or low bridges.
- **Load weight must be between 1 and 80,000 lb**, the US federal limit for a
  loaded truck.
- **Departures are accepted from the current hour up to 13 days ahead**, so the
  trip and the 48-hour slider stay inside the 16-day forecast.
- **Rain is Open-Meteo's `rain` plus `showers`**, and snow is its `snowfall`
  (depth of fresh snow, not water equivalent), both converted to inches per hour.
- **The heatmap samples a band around every route**: points every 10 miles
  along each route and 10 miles to each side, merged onto a grid of about 14
  miles. The grid coarsens automatically so a trip never needs more than 150
  weather locations for the heatmap.
- **Route geometry is thinned** to points at least half a mile apart before it
  is sent to the browser, which keeps responses small.
- **Errors use stable codes** (for example `trip_too_long`, `departure_in_past`)
  so the interface can show a clear message for each.

## Interface

- **A landing page explains the product before anything else.** A short hero
  (headline, one sentence, three "how it works" steps) sits above a centered
  trip form, so a first-time visitor knows what the tool does.
- **The map appears only once there is something to show.** After a successful
  plan, the page animates into a results view: a side panel with a compact trip
  summary and the route cards, and the map filling the rest. "Edit trip" opens
  the form in place, prefilled. On narrow screens the panel stacks above the map.
- **The user stays on the form while planning.** Planning takes a few seconds;
  the button shows progress steps, and if planning fails the error appears next
  to the form instead of on an empty map.
- **A custom date and time picker replaces the browser's own**, whose popup
  cannot be styled. It only offers days the forecast can cover and 30-minute
  time slots.
- **Motion is short and purposeful** (entrance fades, the panel sliding in) and
  is switched off when the system asks for reduced motion.
- **Each route has its own color, and checkpoint dots show risk.** The
  recommended route is drawn thicker and carries a badge. Risk colors are used
  only for checkpoint dots and the heatmap, so the two never get confused.
- **Checkpoint details open in a popup on the map** (arrival time, wind, rain,
  snow, risk level). Route cards stay short: distance, travel time, miles at
  each risk level, and warnings.
- **Place search runs in the browser** against Photon with a short delay after
  typing, so the Django API only does the planning.
