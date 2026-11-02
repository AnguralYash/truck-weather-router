"""Plan a trip: routes, checkpoints, weather risk, recommendation, and heatmap."""

from collections.abc import Callable, Iterator, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx

from .explain import explain_ranking
from .geometry import (
    LatLon,
    arrival_time,
    bearing_degrees,
    checkpoint_miles,
    cumulative_miles,
    offset_point,
    point_at,
    simplify,
)
from .risk import RiskLevel, assess
from .summary import CheckpointRisk, RouteCandidate, rank_routes, summarize_route
from .valhalla import (
    NoRouteError,
    RouteOption,
    RoutingError,
    TripTooLongError,
    fetch_routes,
)
from .weather import (
    HourlySeries,
    WeatherError,
    fetch_hourly,
    forecast_window,
    lookup_timezone,
)

ALLOWED_SPACINGS_MILES = (10, 25, 50)
MAX_LOAD_LB = 80_000  # US federal gross vehicle weight limit
MAX_DAYS_AHEAD = 13  # keeps departure + trip + 48 h inside the 16-day forecast
HEATMAP_HOURS = 48
HEATMAP_STEP_MILES = 10
HEATMAP_HALF_WIDTH_MILES = 10
HEATMAP_MAX_CELLS = 150
GEOMETRY_MIN_GAP_MILES = 0.5
US_BOUNDS = (24.0, 50.0, -125.0, -66.0)  # south, north, west, east


class PlanError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


@dataclass(frozen=True)
class PlanRequest:
    origin: LatLon
    destination: LatLon
    departure_local: datetime  # naive: the time on the clock at the origin
    load_lb: float
    spacing_miles: int


RoutesFn = Callable[[LatLon, LatLon], list[RouteOption]]
WeatherFn = Callable[[Sequence[LatLon], datetime, datetime], list[HourlySeries]]
TimezoneFn = Callable[[LatLon], ZoneInfo]


def plan_trip(
    request: PlanRequest,
    now: datetime,
    routes_fn: RoutesFn = fetch_routes,
    weather_fn: WeatherFn = fetch_hourly,
    timezone_fn: TimezoneFn = lookup_timezone,
) -> dict:
    _validate(request)
    try:
        zone = timezone_fn(request.origin)
        departure = _to_utc(request.departure_local, zone, now)
        options = routes_fn(request.origin, request.destination)
    except TripTooLongError as error:
        raise PlanError(
            "trip_too_long",
            "This trip is too long for the routing service (about 930 miles / "
            "1,500 km at most). Try a shorter trip.",
            422,
        ) from error
    except NoRouteError as error:
        raise PlanError(
            "no_route", "No drivable route was found between these places.", 422
        ) from error
    except (RoutingError, WeatherError, httpx.HTTPError) as error:
        raise PlanError("upstream_unavailable", str(error), 502) from error

    routes = [_Geometry.from_option(i, option) for i, option in enumerate(options, 1)]
    heat_points = _heatmap_points(routes)
    checkpoint_points = [
        point for route in routes for point in route.checkpoint_points(request)
    ]

    start, end = forecast_window(
        departure, max(r.option.duration_s for r in routes), HEATMAP_HOURS
    )
    try:
        series = weather_fn([*checkpoint_points, *heat_points], start, end)
    except WeatherError as error:
        raise PlanError("weather_unavailable", error.args[0], 502) from error
    checkpoint_series = iter(series[: len(checkpoint_points)])
    heat_series = series[len(checkpoint_points) :]

    try:
        results = [
            _assess_route(route, request, departure, checkpoint_series)
            for route in routes
        ]
        heatmap = _heatmap(heat_points, heat_series, departure, request.load_lb)
    except WeatherError as error:
        raise PlanError("weather_unavailable", error.args[0], 502) from error

    ranked = rank_routes([r.candidate for r in results])
    rank_of = {candidate.route_id: i for i, candidate in enumerate(ranked, 1)}
    notes = _ranking_notes(ranked)
    output = [
        {**r.payload, "rank": rank_of[r.candidate.route_id]}
        for r in sorted(results, key=lambda r: rank_of[r.candidate.route_id])
    ]
    for route in output:
        route["recommended"] = route["rank"] == 1
        route["ranking_note"] = notes.get(route["id"])

    return {
        "departure_utc": departure.isoformat(),
        "timezone": str(zone),
        "spacing_miles": request.spacing_miles,
        "load_lb": request.load_lb,
        "recommended_route_id": ranked[0].route_id,
        "notice": _notice(len(routes)),
        "routes": output,
        "heatmap": heatmap,
    }


def _validate(request: PlanRequest) -> None:
    if request.spacing_miles not in ALLOWED_SPACINGS_MILES:
        raise PlanError(
            "invalid_spacing", "Checkpoint spacing must be 10, 25, or 50 miles."
        )
    if not 0 < request.load_lb <= MAX_LOAD_LB:
        raise PlanError(
            "invalid_load", f"Load weight must be between 1 and {MAX_LOAD_LB:,} lb."
        )
    south, north, west, east = US_BOUNDS
    for place in (request.origin, request.destination):
        if not (south <= place.lat <= north and west <= place.lon <= east):
            raise PlanError(
                "outside_service_area", "Both places must be in the contiguous US."
            )
    if request.origin == request.destination:
        raise PlanError("same_place", "Origin and destination must be different.")


def _to_utc(local: datetime, zone: ZoneInfo, now: datetime) -> datetime:
    departure = local.replace(tzinfo=zone).astimezone(UTC)
    if departure < now.replace(minute=0, second=0, microsecond=0):
        raise PlanError("departure_in_past", "The departure time has already passed.")
    if departure > now + timedelta(days=MAX_DAYS_AHEAD):
        raise PlanError(
            "departure_too_far",
            f"Departure must be within {MAX_DAYS_AHEAD} days; "
            "forecasts do not reach further.",
        )
    return departure


def _ranking_notes(ranked: Sequence[RouteCandidate]) -> dict[str, str]:
    """Why each route ranked where it did.

    The best route is explained against the runner-up, the rest against the best.
    """
    if len(ranked) < 2:
        return {}
    best, runner_up = ranked[0], ranked[1]
    notes = {best.route_id: explain_ranking(best, runner_up, is_best=True)}
    for candidate in ranked[1:]:
        notes[candidate.route_id] = explain_ranking(candidate, best, is_best=False)
    return notes


def _notice(route_count: int) -> str | None:
    if route_count >= 3:
        return None
    if route_count == 2:
        return (
            "Only 2 distinct routes found for this trip. The routing service "
            "didn't find a third reasonable alternative."
        )
    return (
        "Only 1 route found for this trip. No reasonable alternatives were available."
    )


@dataclass(frozen=True)
class _Geometry:
    route_id: str
    option: RouteOption
    cumulative: list[float]

    @classmethod
    def from_option(cls, index: int, option: RouteOption) -> "_Geometry":
        cumulative = cumulative_miles(option.shape, option.distance_miles)
        return cls(f"route-{index}", option, cumulative)

    @property
    def total_miles(self) -> float:
        return self.option.distance_miles

    def point(self, mile: float) -> LatLon:
        return point_at(self.option.shape, self.cumulative, mile)

    def checkpoint_miles(self, request: PlanRequest) -> list[float]:
        return checkpoint_miles(self.total_miles, request.spacing_miles)

    def checkpoint_points(self, request: PlanRequest) -> list[LatLon]:
        return [self.point(m) for m in self.checkpoint_miles(request)]


@dataclass(frozen=True)
class _RouteResult:
    candidate: RouteCandidate
    payload: dict


def _assess_route(
    route: _Geometry,
    request: PlanRequest,
    departure: datetime,
    checkpoint_series: Iterator[HourlySeries],
) -> _RouteResult:
    miles = route.checkpoint_miles(request)
    checkpoints = []
    risks = []
    for mile in miles:
        point = route.point(mile)
        eta = arrival_time(departure, route.option.duration_s, mile, route.total_miles)
        weather = next(checkpoint_series).at(eta)
        assessment = assess(weather, request.load_lb)
        risks.append(CheckpointRisk(mile=mile, level=assessment.level))
        checkpoints.append(
            {
                "mile": round(mile, 1),
                "lat": round(point.lat, 5),
                "lon": round(point.lon, 5),
                "eta_utc": eta.isoformat(),
                "level": assessment.level.name,
                "wind_mph": round(weather.wind_mph, 1),
                "rain_in_per_hr": round(weather.rain_in_per_hr, 2),
                "snow_in_per_hr": round(weather.snow_in_per_hr, 2),
                "wind_level": assessment.wind.name,
                "rain_level": assessment.rain.name,
                "snow_level": assessment.snow.name,
            }
        )
    summary = summarize_route(risks, route.total_miles)
    shape = simplify(route.option.shape, route.cumulative, GEOMETRY_MIN_GAP_MILES)
    payload = {
        "id": route.route_id,
        "distance_miles": round(route.total_miles, 1),
        "duration_s": round(route.option.duration_s),
        "geometry": [[round(p.lat, 5), round(p.lon, 5)] for p in shape],
        "checkpoints": checkpoints,
        "summary": {
            "miles_by_level": {
                level.name: round(summary.miles_by_level[level], 1)
                for level in RiskLevel
            },
            "average_risk": round(summary.average, 2),
            "has_no_travel": summary.has_no_travel,
        },
    }
    candidate = RouteCandidate(route.route_id, summary, route.option.duration_s)
    return _RouteResult(candidate, payload)


def _heatmap_points(routes: Sequence[_Geometry]) -> list[LatLon]:
    """Sample a band around every route, then merge samples onto a coarse grid."""
    samples: list[LatLon] = []
    for route in routes:
        miles = [*_frange(0, route.total_miles, HEATMAP_STEP_MILES), route.total_miles]
        for mile in miles:
            centre = route.point(mile)
            ahead = route.point(min(mile + 1, route.total_miles))
            behind = route.point(max(mile - 1, 0))
            heading = bearing_degrees(behind, ahead) if behind != ahead else 0.0
            samples.append(centre)
            for side in (90, -90):
                samples.append(
                    offset_point(
                        centre, (heading + side) % 360, HEATMAP_HALF_WIDTH_MILES
                    )
                )
    grid = 0.2
    while True:
        cells = {(round(p.lat / grid), round(p.lon / grid)) for p in samples}
        if len(cells) <= HEATMAP_MAX_CELLS:
            break
        grid *= 1.5
    return [LatLon(round(i * grid, 4), round(j * grid, 4)) for i, j in sorted(cells)]


def _frange(start: float, stop: float, step: float) -> list[float]:
    values = []
    value = start
    while value < stop - 0.5:
        values.append(value)
        value += step
    return values


def _heatmap(
    points: Sequence[LatLon],
    series: Sequence[HourlySeries],
    departure: datetime,
    load_lb: float,
) -> dict:
    cells = []
    for point, hourly in zip(points, series, strict=True):
        levels = [
            int(assess(hourly.at(departure + timedelta(hours=h)), load_lb).level)
            for h in range(HEATMAP_HOURS + 1)
        ]
        cells.append({"lat": point.lat, "lon": point.lon, "levels": levels})
    return {"hours": HEATMAP_HOURS, "cells": cells}
