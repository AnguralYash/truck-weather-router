"""Distances along a route, checkpoint placement, and arrival times."""

import math
from bisect import bisect_right
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from itertools import pairwise

EARTH_RADIUS_MILES = 3958.8


@dataclass(frozen=True)
class LatLon:
    lat: float
    lon: float


def haversine_miles(a: LatLon, b: LatLon) -> float:
    lat1, lat2 = math.radians(a.lat), math.radians(b.lat)
    dlat = lat2 - lat1
    dlon = math.radians(b.lon - a.lon)
    h = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    )
    return 2 * EARTH_RADIUS_MILES * math.asin(math.sqrt(h))


def bearing_degrees(a: LatLon, b: LatLon) -> float:
    lat1, lat2 = math.radians(a.lat), math.radians(b.lat)
    dlon = math.radians(b.lon - a.lon)
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(
        dlon
    )
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def offset_point(origin: LatLon, bearing: float, miles: float) -> LatLon:
    """The point reached by travelling `miles` from `origin` along `bearing`."""
    angular = miles / EARTH_RADIUS_MILES
    theta = math.radians(bearing)
    lat1, lon1 = math.radians(origin.lat), math.radians(origin.lon)
    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular)
        + math.cos(lat1) * math.sin(angular) * math.cos(theta)
    )
    lon2 = lon1 + math.atan2(
        math.sin(theta) * math.sin(angular) * math.cos(lat1),
        math.cos(angular) - math.sin(lat1) * math.sin(lat2),
    )
    return LatLon(math.degrees(lat2), (math.degrees(lon2) + 540) % 360 - 180)


def decode_polyline(encoded: str, precision: int = 6) -> list[LatLon]:
    """Decode a Google-style encoded polyline (Valhalla uses 6 decimal places)."""
    factor = 10**precision
    points: list[LatLon] = []
    index = lat = lon = 0
    while index < len(encoded):
        for axis in (0, 1):
            shift = result = 0
            while True:
                chunk = ord(encoded[index]) - 63
                index += 1
                result |= (chunk & 0x1F) << shift
                shift += 5
                if chunk < 0x20:
                    break
            delta = ~(result >> 1) if result & 1 else result >> 1
            if axis == 0:
                lat += delta
            else:
                lon += delta
        points.append(LatLon(lat / factor, lon / factor))
    return points


def cumulative_miles(points: Sequence[LatLon], total_miles: float) -> list[float]:
    """Distance from the start to each point, scaled to the route's real length.

    Straight lines between shape points are slightly shorter than the road, so
    the distances are scaled to match the length the routing service reports.
    """
    raw = [0.0]
    for previous, current in pairwise(points):
        raw.append(raw[-1] + haversine_miles(previous, current))
    scale = total_miles / raw[-1] if raw[-1] > 0 else 0.0
    return [d * scale for d in raw]


def point_at(
    points: Sequence[LatLon], cumulative: Sequence[float], mile: float
) -> LatLon:
    """The point `mile` miles along the route, interpolated between shape points."""
    if mile <= 0:
        return points[0]
    if mile >= cumulative[-1]:
        return points[-1]
    i = bisect_right(cumulative, mile)
    span = cumulative[i] - cumulative[i - 1]
    fraction = (mile - cumulative[i - 1]) / span if span > 0 else 0.0
    a, b = points[i - 1], points[i]
    return LatLon(
        a.lat + (b.lat - a.lat) * fraction, a.lon + (b.lon - a.lon) * fraction
    )


def checkpoint_miles(total_miles: float, spacing_miles: float) -> list[float]:
    """Start, every `spacing_miles` after it, and the end of the route."""
    miles = [0.0]
    step = spacing_miles
    while step < total_miles - 0.5:
        miles.append(step)
        step += spacing_miles
    miles.append(total_miles)
    return miles


def arrival_time(
    departure: datetime, duration_s: float, mile: float, total_miles: float
) -> datetime:
    """Arrival at `mile`, assuming a constant average speed over the route."""
    fraction = mile / total_miles if total_miles > 0 else 0.0
    return departure + timedelta(seconds=duration_s * fraction)


def simplify(
    points: Sequence[LatLon], cumulative: Sequence[float], min_gap_miles: float
) -> list[LatLon]:
    """Drop shape points closer than `min_gap_miles` to keep responses small."""
    kept = [points[0]]
    last = cumulative[0]
    for point, distance in zip(points[1:-1], cumulative[1:-1], strict=True):
        if distance - last >= min_gap_miles:
            kept.append(point)
            last = distance
    kept.append(points[-1])
    return kept
