import pytest

from routing.risk import RiskLevel
from routing.summary import (
    CheckpointRisk,
    RouteCandidate,
    RouteRisk,
    rank_routes,
    summarize_route,
)

L, M, H, S, N = (
    RiskLevel.LOW,
    RiskLevel.MODERATE,
    RiskLevel.HIGH,
    RiskLevel.SEVERE,
    RiskLevel.NO_TRAVEL,
)


def risk(**miles: float) -> RouteRisk:
    by_level = {level: miles.get(level.name.lower(), 0.0) for level in RiskLevel}
    total = sum(by_level.values())
    average = sum(level * m for level, m in by_level.items()) / total
    return RouteRisk(miles_by_level=by_level, average=average)


def test_each_checkpoint_covers_halfway_to_its_neighbours() -> None:
    checkpoints = [CheckpointRisk(0, L), CheckpointRisk(25, H), CheckpointRisk(50, L)]

    result = summarize_route(checkpoints, route_miles=60)

    # LOW covers 0-12.5 and 37.5-60; HIGH covers 12.5-37.5.
    assert result.miles_by_level[L] == pytest.approx(35)
    assert result.miles_by_level[H] == pytest.approx(25)
    assert sum(result.miles_by_level.values()) == pytest.approx(60)


def test_average_risk_is_weighted_by_miles() -> None:
    checkpoints = [CheckpointRisk(0, L), CheckpointRisk(50, S)]

    result = summarize_route(checkpoints, route_miles=100)

    # The last checkpoint covers everything from the midpoint (25) to the end:
    # 25 miles at level 1 and 75 miles at level 4.
    assert result.average == pytest.approx(3.25)


def test_single_checkpoint_covers_the_whole_route() -> None:
    result = summarize_route([CheckpointRisk(0, M)], route_miles=40)

    assert result.miles_by_level[M] == pytest.approx(40)
    assert result.average == pytest.approx(2)


def test_no_travel_is_flagged() -> None:
    result = summarize_route([CheckpointRisk(0, L), CheckpointRisk(10, N)], 20)

    assert result.has_no_travel
    assert not summarize_route([CheckpointRisk(0, S)], 20).has_no_travel


def test_empty_or_unordered_checkpoints_are_rejected() -> None:
    with pytest.raises(ValueError, match="at least one"):
        summarize_route([], route_miles=10)
    with pytest.raises(ValueError, match="ordered"):
        summarize_route([CheckpointRisk(10, L), CheckpointRisk(0, L)], 20)


def ids(routes: list[RouteCandidate]) -> list[str]:
    return [r.route_id for r in routes]


def test_fewest_severe_miles_wins_even_if_slower() -> None:
    fast = RouteCandidate("fast", risk(low=90, severe=10), duration_s=3600)
    slow = RouteCandidate("slow", risk(low=95, severe=5), duration_s=36_000)

    assert ids(rank_routes([fast, slow])) == ["slow", "fast"]


def test_high_miles_break_a_severe_tie() -> None:
    a = RouteCandidate("a", risk(low=80, high=20), duration_s=100)
    b = RouteCandidate("b", risk(low=90, high=10), duration_s=900)

    assert ids(rank_routes([a, b])) == ["b", "a"]


def test_average_risk_breaks_a_severe_and_high_tie() -> None:
    a = RouteCandidate("a", risk(low=50, moderate=50), duration_s=100)
    b = RouteCandidate("b", risk(low=80, moderate=20), duration_s=900)

    assert ids(rank_routes([a, b])) == ["b", "a"]


def test_travel_time_is_the_last_tie_breaker() -> None:
    a = RouteCandidate("a", risk(low=100), duration_s=500)
    b = RouteCandidate("b", risk(low=100), duration_s=400)

    assert ids(rank_routes([a, b])) == ["b", "a"]


def test_route_with_no_travel_ranks_last_even_if_otherwise_best() -> None:
    blocked = RouteCandidate("blocked", risk(low=99, no_travel=1), duration_s=100)
    safe = RouteCandidate("safe", risk(low=50, severe=50), duration_s=9000)

    assert ids(rank_routes([blocked, safe])) == ["safe", "blocked"]


def test_when_all_routes_have_no_travel_the_least_bad_is_first() -> None:
    a = RouteCandidate("a", risk(low=80, no_travel=20), duration_s=100)
    b = RouteCandidate("b", risk(low=95, no_travel=5), duration_s=900)

    assert ids(rank_routes([a, b])) == ["b", "a"]
