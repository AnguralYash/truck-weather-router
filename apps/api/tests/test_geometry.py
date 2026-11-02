from datetime import UTC, datetime

import pytest

from routing.geometry import (
    LatLon,
    arrival_time,
    bearing_degrees,
    checkpoint_miles,
    cumulative_miles,
    decode_polyline,
    haversine_miles,
    offset_point,
    point_at,
    simplify,
)

CHICAGO = LatLon(41.8781, -87.6298)
DALLAS = LatLon(32.7767, -96.7970)


def encode_polyline(points: list[LatLon], precision: int = 6) -> str:
    factor = 10**precision
    out = []
    previous = (0, 0)
    for p in points:
        current = (round(p.lat * factor), round(p.lon * factor))
        for value, prior in zip(current, previous, strict=True):
            delta = value - prior
            delta = ~(delta << 1) if delta < 0 else delta << 1
            while delta >= 0x20:
                out.append(chr((0x20 | (delta & 0x1F)) + 63))
                delta >>= 5
            out.append(chr(delta + 63))
        previous = current
    return "".join(out)


def test_haversine_matches_a_known_distance() -> None:
    # Chicago to Dallas is about 800 miles in a straight line.
    assert haversine_miles(CHICAGO, DALLAS) == pytest.approx(802, abs=5)


def test_polyline_round_trip() -> None:
    points = [LatLon(41.8781, -87.6298), LatLon(41.9, -87.7), LatLon(40.0, -90.5)]

    decoded = decode_polyline(encode_polyline(points))

    assert decoded == [
        LatLon(pytest.approx(p.lat, abs=1e-6), pytest.approx(p.lon, abs=1e-6))
        for p in points
    ]


def test_cumulative_miles_scales_to_the_reported_length() -> None:
    points = [LatLon(40, -90), LatLon(40, -89), LatLon(40, -88)]

    cumulative = cumulative_miles(points, total_miles=200)

    assert cumulative[0] == 0
    assert cumulative[-1] == pytest.approx(200)
    assert cumulative[1] == pytest.approx(100, abs=0.5)


def test_point_at_interpolates_between_shape_points() -> None:
    points = [LatLon(40, -90), LatLon(40, -88)]
    cumulative = [0.0, 100.0]

    middle = point_at(points, cumulative, 50)

    assert middle.lat == pytest.approx(40)
    assert middle.lon == pytest.approx(-89)
    assert point_at(points, cumulative, -5) == points[0]
    assert point_at(points, cumulative, 500) == points[-1]


def test_checkpoints_include_start_and_end() -> None:
    assert checkpoint_miles(60, 25) == [0, 25, 50, 60]


def test_checkpoint_near_the_end_is_not_duplicated() -> None:
    assert checkpoint_miles(50.2, 25) == [0, 25, 50.2]


def test_short_route_has_only_start_and_end() -> None:
    assert checkpoint_miles(8, 25) == [0, 8]


def test_arrival_time_is_proportional_to_distance() -> None:
    departure = datetime(2026, 11, 3, 12, 0, tzinfo=UTC)

    halfway = arrival_time(departure, duration_s=7200, mile=50, total_miles=100)

    assert halfway == datetime(2026, 11, 3, 13, 0, tzinfo=UTC)


def test_offset_point_moves_the_requested_distance() -> None:
    moved = offset_point(CHICAGO, bearing=90, miles=10)

    assert haversine_miles(CHICAGO, moved) == pytest.approx(10, abs=0.05)
    assert moved.lon > CHICAGO.lon


def test_bearing_east_is_ninety_degrees() -> None:
    assert bearing_degrees(LatLon(0, 0), LatLon(0, 1)) == pytest.approx(90)


def test_simplify_keeps_the_ends_and_drops_close_points() -> None:
    points = [LatLon(40, -90 + i * 0.01) for i in range(101)]
    cumulative = cumulative_miles(points, total_miles=100)

    kept = simplify(points, cumulative, min_gap_miles=10)

    assert kept[0] == points[0]
    assert kept[-1] == points[-1]
    assert 8 <= len(kept) <= 13
