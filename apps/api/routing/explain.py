"""One-line reasons for where a route ranked, in terms of the brief's order."""

from .summary import RouteCandidate, rank_key

# The criteria in ranking order. The first two keys of `rank_key` both concern
# No Travel, so they share a name.
CRITERIA = ["no_travel", "no_travel", "severe", "high", "average", "time"]


def _route(candidate: RouteCandidate) -> str:
    return f"Route {candidate.route_id.split('-')[1]}"


def _miles(value: float) -> str:
    if value >= 1:
        return f"{value:.0f} mi"
    return f"{value:.1f} mi" if value > 0.05 else "0 mi"


def _time_gap(seconds: float) -> str:
    seconds = abs(seconds)
    return f"{round(seconds / 60)} min" if seconds >= 90 else f"{round(seconds)} s"


# Below this, a time difference is too small to matter to a driver. The ranking
# still follows the brief's order exactly; the note just says so.
NEAR_TIE_S = 120


def _first_difference(a: RouteCandidate, b: RouteCandidate) -> str | None:
    """The first criterion, in ranking order, on which the two routes differ."""
    for name, value_a, value_b in zip(CRITERIA, rank_key(a), rank_key(b), strict=True):
        if value_a != value_b:
            return name
    return None


def explain_ranking(
    route: RouteCandidate, other: RouteCandidate, *, is_best: bool
) -> str:
    """Why `route` beat `other` (when it is the best) or trails it (when it is not)."""
    criterion = _first_difference(route, other)
    mine, theirs = route.risk, other.risk
    gap = _time_gap(route.duration_s - other.duration_s)
    if is_best:
        name = _route(other)
        reasons = {
            "no_travel": "Avoids No Travel conditions: "
            f"{_miles(mine.no_travel_miles)} vs {_miles(theirs.no_travel_miles)} "
            f"on {name}.",
            "severe": "Fewest Severe-risk miles: "
            f"{_miles(mine.severe_miles)} vs {_miles(theirs.severe_miles)} on {name}.",
            "high": "Fewest High-risk miles: "
            f"{_miles(mine.high_miles)} vs {_miles(theirs.high_miles)} on {name}.",
            "average": "Lowest average risk: "
            f"{mine.average:.2f} vs {theirs.average:.2f} on {name}.",
            "time": f"Same weather risk as {name} and only {gap} quicker, so "
            "effectively a tie."
            if abs(route.duration_s - other.duration_s) < NEAR_TIE_S
            else f"Same weather risk as {name}, but quicker by {gap}.",
        }
        tied = f"Tied with {name} on every measure."
    else:
        reasons = {
            "no_travel": f"{_miles(mine.no_travel_miles)} of No Travel conditions "
            f"(recommended route: {_miles(theirs.no_travel_miles)}).",
            "severe": f"{_miles(mine.severe_miles)} of Severe risk "
            f"(recommended route: {_miles(theirs.severe_miles)}).",
            "high": f"{_miles(mine.high_miles)} of High risk "
            f"(recommended route: {_miles(theirs.high_miles)}).",
            "average": f"Higher average risk: {mine.average:.2f} vs "
            f"{theirs.average:.2f} on the recommended route.",
            "time": f"Same weather risk and only {gap} slower than the recommended "
            "route, so effectively a tie."
            if abs(route.duration_s - other.duration_s) < NEAR_TIE_S
            else f"Same weather risk, but {gap} slower than the recommended route.",
        }
        tied = "Tied with the recommended route on every measure."
    return reasons.get(criterion or "", tied)
