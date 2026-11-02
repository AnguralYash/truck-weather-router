from routing.explain import explain_ranking
from routing.risk import RiskLevel
from routing.summary import RouteCandidate, RouteRisk


def candidate(
    route_id: str,
    *,
    low: float = 100,
    high: float = 0,
    severe: float = 0,
    no_travel: float = 0,
    duration_s: float = 3600,
) -> RouteCandidate:
    by_level = {level: 0.0 for level in RiskLevel}
    by_level[RiskLevel.LOW] = low
    by_level[RiskLevel.HIGH] = high
    by_level[RiskLevel.SEVERE] = severe
    by_level[RiskLevel.NO_TRAVEL] = no_travel
    total = sum(by_level.values())
    average = sum(level * miles for level, miles in by_level.items()) / total
    return RouteCandidate(
        route_id, RouteRisk(miles_by_level=by_level, average=average), duration_s
    )


def test_best_route_with_fewer_severe_miles_says_so() -> None:
    best = candidate("route-2", severe=0)
    other = candidate("route-1", severe=25)

    assert explain_ranking(best, other, is_best=True) == (
        "Fewest Severe-risk miles: 0 mi vs 25 mi on Route 1."
    )


def test_best_route_with_fewer_high_miles_says_so() -> None:
    assert "Fewest High-risk miles: 0 mi vs 50 mi on Route 3" in explain_ranking(
        candidate("route-1"), candidate("route-3", high=50), is_best=True
    )


def test_equal_risk_is_decided_by_time_and_the_reason_says_how_much() -> None:
    best = candidate("route-2", duration_s=5100)
    other = candidate("route-1", duration_s=5112)

    assert explain_ranking(best, other, is_best=True) == (
        "Same weather risk as Route 1 and only 12 s quicker, so effectively a tie."
    )


def test_larger_time_gaps_are_shown_in_minutes() -> None:
    best = candidate("route-2", duration_s=3600)
    other = candidate("route-1", duration_s=3600 + 7 * 60)

    note = explain_ranking(best, other, is_best=True)
    assert "quicker by 7 min" in note
    assert "effectively a tie" not in note


def test_best_route_that_avoids_no_travel_says_so() -> None:
    best = candidate("route-2")
    other = candidate("route-1", no_travel=10)

    assert explain_ranking(best, other, is_best=True).startswith(
        "Avoids No Travel conditions"
    )


def test_a_route_behind_the_best_explains_its_first_shortfall() -> None:
    best = candidate("route-2")
    slower = candidate("route-1", duration_s=3700)
    riskier = candidate("route-3", high=25)

    assert explain_ranking(slower, best, is_best=False) == (
        "Same weather risk and only 2 min slower than the recommended route, "
        "so effectively a tie."
    )
    assert explain_ranking(riskier, best, is_best=False) == (
        "25 mi of High risk (recommended route: 0 mi)."
    )


def test_identical_routes_are_reported_as_tied() -> None:
    a, b = candidate("route-1"), candidate("route-2")

    assert explain_ranking(a, b, is_best=True) == "Tied with Route 2 on every measure."


def test_a_clear_time_gap_is_not_called_a_tie() -> None:
    best = candidate("route-2", duration_s=3600)
    slower = candidate("route-1", duration_s=3600 + 10 * 60)

    assert explain_ranking(slower, best, is_best=False) == (
        "Same weather risk, but 10 min slower than the recommended route."
    )
