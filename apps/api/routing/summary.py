"""Summarise a route's risk from its checkpoints and rank candidate routes."""

from collections.abc import Sequence
from dataclasses import dataclass

from .risk import RiskLevel


@dataclass(frozen=True)
class CheckpointRisk:
    mile: float
    level: RiskLevel


@dataclass(frozen=True)
class RouteRisk:
    miles_by_level: dict[RiskLevel, float]
    average: float

    @property
    def no_travel_miles(self) -> float:
        return self.miles_by_level[RiskLevel.NO_TRAVEL]

    @property
    def severe_miles(self) -> float:
        return self.miles_by_level[RiskLevel.SEVERE]

    @property
    def high_miles(self) -> float:
        return self.miles_by_level[RiskLevel.HIGH]

    @property
    def has_no_travel(self) -> bool:
        return self.no_travel_miles > 0


def summarize_route(
    checkpoints: Sequence[CheckpointRisk], route_miles: float
) -> RouteRisk:
    """Give each checkpoint the stretch halfway to its neighbours on each side.

    The first checkpoint covers from the route start and the last to the route
    end, so the covered stretches add up to the full route length.
    """
    if not checkpoints:
        raise ValueError("A route needs at least one checkpoint")
    miles = [c.mile for c in checkpoints]
    if miles != sorted(miles):
        raise ValueError("Checkpoints must be ordered by distance along the route")

    miles_by_level = {level: 0.0 for level in RiskLevel}
    for i, checkpoint in enumerate(checkpoints):
        start = 0.0 if i == 0 else (miles[i - 1] + miles[i]) / 2
        end = route_miles if i == len(miles) - 1 else (miles[i] + miles[i + 1]) / 2
        miles_by_level[checkpoint.level] += end - start

    total = sum(miles_by_level.values())
    average = (
        sum(level * covered for level, covered in miles_by_level.items()) / total
        if total > 0
        else float(checkpoints[0].level)
    )
    return RouteRisk(miles_by_level=miles_by_level, average=average)


@dataclass(frozen=True)
class RouteCandidate:
    route_id: str
    risk: RouteRisk
    duration_s: float


def rank_key(route: RouteCandidate) -> tuple[bool, float, float, float, float, float]:
    """Sort key: lower is better.

    A route with No Travel ranks after every route without it. Then the brief's
    order applies: fewest Severe miles, fewest High miles, lowest average risk,
    shortest travel time. Miles are rounded to a tenth so floating-point noise
    cannot decide a tie.
    """
    risk = route.risk
    return (
        risk.has_no_travel,
        round(risk.no_travel_miles, 1),
        round(risk.severe_miles, 1),
        round(risk.high_miles, 1),
        round(risk.average, 2),
        route.duration_s,
    )


def rank_routes(routes: Sequence[RouteCandidate]) -> list[RouteCandidate]:
    return sorted(routes, key=rank_key)
