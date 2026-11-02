from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from routing.geometry import LatLon
from routing.planner import HEATMAP_MAX_CELLS, PlanError, PlanRequest, plan_trip
from routing.valhalla import NoRouteError, RouteOption, TripTooLongError
from routing.weather import HourlySeries

NOW = datetime(2026, 11, 2, 12, 0, tzinfo=UTC)
ORIGIN = LatLon(40.0, -90.0)
DESTINATION = LatLon(40.0, -88.0)


def straight_route(lat: float, minutes: int = 120) -> RouteOption:
    shape = [LatLon(lat, -90 + i * 0.02) for i in range(101)]
    return RouteOption(shape=shape, distance_miles=100, duration_s=minutes * 60)


def request(**overrides: object) -> PlanRequest:
    values = {
        "origin": ORIGIN,
        "destination": DESTINATION,
        "departure_local": datetime(2026, 11, 3, 12, 0),
        "load_lb": 20_000,
        "spacing_miles": 25,
    }
    return PlanRequest(**{**values, **overrides})  # type: ignore[arg-type]


def weather_by_latitude(windy_above: float | None = None, hours: int = 96):
    """Fake forecast: wind is 60 mph north of `windy_above`, otherwise calm."""

    def fetch(points, start, _end):
        first = datetime(start.year, start.month, start.day, tzinfo=UTC)
        return [
            HourlySeries(
                start=first,
                wind_mph=[
                    60.0 if windy_above is not None and p.lat > windy_above else 5.0
                ]
                * hours,
                rain_in=[0.0] * hours,
                snow_in=[0.0] * hours,
            )
            for p in points
        ]

    return fetch


def chicago(_point: LatLon) -> ZoneInfo:
    return ZoneInfo("America/Chicago")


def plan(req: PlanRequest, routes, weather=None):
    return plan_trip(
        req,
        NOW,
        routes_fn=lambda _a, _b: routes,
        weather_fn=weather or weather_by_latitude(),
        timezone_fn=chicago,
    )


def test_departure_is_read_in_the_origin_time_zone() -> None:
    result = plan(request(), [straight_route(40.0)])

    # Noon on 3 Nov in Chicago (CST, UTC-6) is 18:00 UTC.
    assert result["departure_utc"] == "2026-11-03T18:00:00+00:00"
    assert result["timezone"] == "America/Chicago"


def test_checkpoints_follow_the_spacing_and_arrival_times() -> None:
    result = plan(request(), [straight_route(40.0, minutes=120)])

    checkpoints = result["routes"][0]["checkpoints"]
    assert [c["mile"] for c in checkpoints] == [0, 25, 50, 75, 100]
    assert checkpoints[0]["eta_utc"] == "2026-11-03T18:00:00+00:00"
    assert checkpoints[2]["eta_utc"] == "2026-11-03T19:00:00+00:00"
    assert checkpoints[-1]["eta_utc"] == "2026-11-03T20:00:00+00:00"


def test_calm_route_is_recommended_over_windy_route() -> None:
    routes = [straight_route(40.5), straight_route(40.0)]

    result = plan(request(), routes, weather_by_latitude(windy_above=40.25))

    assert result["recommended_route_id"] == "route-2"
    assert [r["id"] for r in result["routes"]] == ["route-2", "route-1"]
    assert [r["recommended"] for r in result["routes"]] == [True, False]
    windy = result["routes"][1]
    assert windy["summary"]["has_no_travel"]
    assert windy["checkpoints"][0]["level"] == "NO_TRAVEL"


def test_load_weight_changes_the_risk() -> None:
    def breezy(points, start, _end):
        first = datetime(start.year, start.month, start.day, tzinfo=UTC)
        return [
            HourlySeries(first, [40.0] * 96, [0.0] * 96, [0.0] * 96) for _ in points
        ]

    light = plan(request(load_lb=20_000), [straight_route(40.0)], breezy)
    heavy = plan(request(load_lb=45_000), [straight_route(40.0)], breezy)

    assert light["routes"][0]["checkpoints"][0]["level"] == "HIGH"
    assert heavy["routes"][0]["checkpoints"][0]["level"] == "SEVERE"


def test_fewer_than_three_routes_adds_a_notice() -> None:
    three = plan(request(), [straight_route(40.0)] * 3)
    two = plan(request(), [straight_route(40.0)] * 2)
    one = plan(request(), [straight_route(40.0)])

    assert three["notice"] is None
    assert "Only 2 distinct routes" in two["notice"]
    assert "Only 1 route" in one["notice"]


def test_heatmap_has_a_risk_level_for_every_hour() -> None:
    result = plan(request(), [straight_route(40.0)])

    heatmap = result["heatmap"]
    assert heatmap["hours"] == 48
    assert 0 < len(heatmap["cells"]) <= HEATMAP_MAX_CELLS
    assert all(len(cell["levels"]) == 49 for cell in heatmap["cells"])
    assert all(level == 1 for cell in heatmap["cells"] for level in cell["levels"])


def test_heatmap_stays_within_the_cell_cap_on_long_trips() -> None:
    shape = [LatLon(41.9 - i * 0.0093, -87.6 - i * 0.0092) for i in range(1000)]
    long_route = RouteOption(shape=shape, distance_miles=930, duration_s=15 * 3600)

    result = plan(
        request(destination=LatLon(32.8, -96.8)), [long_route, long_route, long_route]
    )

    assert len(result["heatmap"]["cells"]) <= HEATMAP_MAX_CELLS


def test_route_geometry_is_simplified() -> None:
    dense = RouteOption(
        shape=[LatLon(40.0, -90 + i * 0.002) for i in range(1001)],
        distance_miles=100,
        duration_s=7200,
    )

    result = plan(request(), [dense])

    assert len(result["routes"][0]["geometry"]) < 300


@pytest.mark.parametrize(
    ("overrides", "code"),
    [
        ({"spacing_miles": 30}, "invalid_spacing"),
        ({"load_lb": 0}, "invalid_load"),
        ({"load_lb": 90_000}, "invalid_load"),
        ({"destination": LatLon(51.5, -0.1)}, "outside_service_area"),
        ({"destination": ORIGIN}, "same_place"),
        ({"departure_local": datetime(2026, 11, 1, 8, 0)}, "departure_in_past"),
        ({"departure_local": datetime(2026, 12, 25, 8, 0)}, "departure_too_far"),
    ],
)
def test_invalid_requests_are_rejected(overrides: dict, code: str) -> None:
    with pytest.raises(PlanError) as error:
        plan(request(**overrides), [straight_route(40.0)])

    assert error.value.code == code
    assert error.value.status == 400


def test_departure_in_the_current_hour_is_allowed() -> None:
    # 06:30 in Chicago is 12:30 UTC, within the current hour at NOW (12:00 UTC).
    plan(request(departure_local=datetime(2026, 11, 2, 6, 30)), [straight_route(40.0)])


def test_trip_too_long_gets_a_friendly_error() -> None:
    def too_long(_a, _b):
        raise TripTooLongError

    with pytest.raises(PlanError) as error:
        plan_trip(request(), NOW, routes_fn=too_long, timezone_fn=chicago)

    assert error.value.code == "trip_too_long"
    assert error.value.status == 422
    assert "too long" in error.value.message


def test_no_route_gets_its_own_error() -> None:
    def none(_a, _b):
        raise NoRouteError

    with pytest.raises(PlanError) as error:
        plan_trip(request(), NOW, routes_fn=none, timezone_fn=chicago)

    assert error.value.code == "no_route"


def test_forecast_gap_becomes_a_weather_error() -> None:
    # A forecast that ends after 3 hours cannot cover a 48-hour slider.
    with pytest.raises(PlanError) as error:
        plan(request(), [straight_route(40.0)], weather_by_latitude(hours=3))

    assert error.value.code == "weather_unavailable"
    assert error.value.status == 502


def test_departure_exactly_at_now_is_allowed() -> None:
    soon = NOW + timedelta(hours=1)
    plan_trip(
        request(departure_local=soon.astimezone(chicago(ORIGIN)).replace(tzinfo=None)),
        NOW,
        routes_fn=lambda _a, _b: [straight_route(40.0)],
        weather_fn=weather_by_latitude(),
        timezone_fn=chicago,
    )
