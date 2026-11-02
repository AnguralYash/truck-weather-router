import httpx
import pytest

from routing.geometry import LatLon
from routing.valhalla import (
    NoRouteError,
    RoutingError,
    TripTooLongError,
    fetch_routes,
)
from tests.test_geometry import encode_polyline

A = LatLon(41.8781, -87.6298)
B = LatLon(38.6270, -90.1994)


def trip(shape: list[LatLon], miles: float, seconds: float) -> dict:
    return {
        "legs": [{"shape": encode_polyline(shape)}],
        "summary": {"length": miles, "time": seconds},
    }


def client_returning(status: int, payload: dict) -> httpx.Client:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, json=payload)

    return httpx.Client(transport=httpx.MockTransport(handler))


def test_returns_the_main_route_and_alternates() -> None:
    payload = {
        "trip": trip([A, B], 297, 17_000),
        "alternates": [{"trip": trip([A, LatLon(40, -89), B], 312, 17_600)}],
    }

    routes = fetch_routes(A, B, client=client_returning(200, payload))

    assert len(routes) == 2
    assert routes[0].distance_miles == 297
    assert routes[0].duration_s == 17_000
    assert routes[1].shape[1] == LatLon(40, -89)


def test_a_route_without_alternates_is_returned_alone() -> None:
    payload = {"trip": trip([A, B], 90, 5_000)}

    assert len(fetch_routes(A, B, client=client_returning(200, payload))) == 1


def test_request_asks_for_truck_costing_and_alternates() -> None:
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = request.read()
        return httpx.Response(200, json={"trip": trip([A, B], 90, 5_000)})

    fetch_routes(A, B, client=httpx.Client(transport=httpx.MockTransport(handler)))

    assert b'"costing":"truck"' in seen["body"].replace(b" ", b"")
    assert b'"alternates":2' in seen["body"].replace(b" ", b"")


def test_too_long_trip_has_its_own_error() -> None:
    payload = {
        "error_code": 154,
        "error": "Path distance exceeds the max distance limit",
    }

    with pytest.raises(TripTooLongError):
        fetch_routes(A, B, client=client_returning(400, payload))


def test_no_route_has_its_own_error() -> None:
    with pytest.raises(NoRouteError):
        fetch_routes(A, B, client=client_returning(400, {"error_code": 442}))


def test_other_failures_become_a_routing_error() -> None:
    with pytest.raises(RoutingError):
        fetch_routes(A, B, client=client_returning(500, {"error": "boom"}))


def test_network_failure_becomes_a_routing_error() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    client = httpx.Client(transport=httpx.MockTransport(handler))

    with pytest.raises(RoutingError):
        fetch_routes(A, B, client=client)
