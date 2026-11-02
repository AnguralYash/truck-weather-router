"""Client for the public Valhalla routing server (truck profile)."""

from dataclasses import dataclass

import httpx

from .geometry import LatLon, decode_polyline
from .http import send_with_retry

VALHALLA_URL = "https://valhalla1.openstreetmap.de/route"
USER_AGENT = "truck-weather-router/0.1"
MAX_ALTERNATES = 2  # the main route plus two alternates makes three

TRIP_TOO_LONG_CODE = 154
NO_ROUTE_CODES = {442, 171}


class RoutingError(Exception):
    """The routing service could not provide routes."""


class TripTooLongError(RoutingError):
    """The trip is longer than the public server allows (about 1,500 km)."""


class NoRouteError(RoutingError):
    """No drivable route exists between the two places."""


@dataclass(frozen=True)
class RouteOption:
    shape: list[LatLon]
    distance_miles: float
    duration_s: float


def fetch_routes(
    origin: LatLon, destination: LatLon, client: httpx.Client | None = None
) -> list[RouteOption]:
    body = {
        "locations": [
            {"lat": origin.lat, "lon": origin.lon},
            {"lat": destination.lat, "lon": destination.lon},
        ],
        "costing": "truck",
        "alternates": MAX_ALTERNATES,
        "units": "miles",
    }
    owns_client = client is None
    http = client or httpx.Client(timeout=45, headers={"User-Agent": USER_AGENT})
    try:
        response = send_with_retry(lambda: http.post(VALHALLA_URL, json=body))
    except httpx.HTTPError as error:
        raise RoutingError("The routing service is not reachable.") from error
    finally:
        if owns_client:
            http.close()

    if response.status_code != 200:
        _raise_for_error(response)

    data = response.json()
    trips = [data["trip"], *(alt["trip"] for alt in data.get("alternates", []))]
    return [_to_route_option(trip) for trip in trips]


def _to_route_option(trip: dict) -> RouteOption:
    shape = [
        point
        for leg in trip["legs"]
        for point in decode_polyline(leg["shape"], precision=6)
    ]
    summary = trip["summary"]
    return RouteOption(
        shape=shape,
        distance_miles=float(summary["length"]),
        duration_s=float(summary["time"]),
    )


def _raise_for_error(response: httpx.Response) -> None:
    try:
        code = response.json().get("error_code")
    except ValueError:
        code = None
    if code == TRIP_TOO_LONG_CODE:
        raise TripTooLongError
    if code in NO_ROUTE_CODES:
        raise NoRouteError
    raise RoutingError(
        f"The routing service returned an error ({response.status_code})."
    )
