from datetime import UTC, datetime, timedelta

import httpx
import pytest

from routing.geometry import LatLon
from routing.weather import (
    HourlySeries,
    WeatherError,
    fetch_hourly,
    forecast_window,
    lookup_timezone,
)

START = datetime(2026, 11, 3, 0, 0, tzinfo=UTC)


def location(wind: list, rain: list, showers: list, snow: list) -> dict:
    hours = [f"2026-11-03T{h:02d}:00" for h in range(len(wind))]
    return {
        "hourly": {
            "time": hours,
            "wind_speed_10m": wind,
            "rain": rain,
            "showers": showers,
            "snowfall": snow,
        }
    }


def client_for(payload: object, status: int = 200) -> httpx.Client:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, json=payload)

    return httpx.Client(transport=httpx.MockTransport(handler))


def test_series_picks_the_nearest_hour() -> None:
    series = HourlySeries(START, [10, 20, 30], [0.0, 0.1, 0.2], [0.0, 0.0, 1.0])

    weather = series.at(START + timedelta(minutes=70))

    assert weather.wind_mph == 20
    assert weather.rain_in_per_hr == 0.1


def test_series_rounds_to_the_closer_hour() -> None:
    series = HourlySeries(START, [10, 20, 30], [0, 0, 0], [0, 0, 0])

    assert series.at(START + timedelta(minutes=100)).wind_mph == 30


def test_series_outside_the_forecast_raises() -> None:
    series = HourlySeries(START, [10, 20], [0, 0], [0, 0])

    with pytest.raises(WeatherError):
        series.at(START + timedelta(hours=5))
    with pytest.raises(WeatherError):
        series.at(START - timedelta(hours=2))


def test_several_locations_come_back_as_a_list() -> None:
    payload = [
        location([10, 11], [0.1, 0.0], [0.05, 0.0], [0.0, 0.5]),
        location([20, 21], [0.0, 0.0], [0.0, 0.0], [0.0, 0.0]),
    ]

    series = fetch_hourly(
        [LatLon(41, -87), LatLon(40, -88)], START, START, client_for(payload)
    )

    assert [s.wind_mph for s in series] == [[10, 11], [20, 21]]
    assert series[0].rain_in == pytest.approx([0.15, 0.0])
    assert series[0].snow_in == [0.0, 0.5]


def test_single_location_comes_back_as_an_object() -> None:
    payload = location([10], [0.0], [0.0], [0.0])

    series = fetch_hourly([LatLon(41, -87)], START, START, client_for(payload))

    assert len(series) == 1


def test_missing_values_are_treated_as_zero() -> None:
    payload = location([None], [None], [None], [None])

    series = fetch_hourly([LatLon(41, -87)], START, START, client_for(payload))

    assert series[0].wind_mph == [0.0]


def test_large_requests_are_split_into_batches() -> None:
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        count = len(request.url.params["latitude"].split(","))
        calls.append(count)
        return httpx.Response(200, json=[location([1], [0], [0], [0])] * count)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    points = [LatLon(40 + i * 0.01, -90) for i in range(250)]

    series = fetch_hourly(points, START, START, client)

    assert sorted(calls) == [50, 100, 100]
    assert len(series) == 250


def test_request_uses_mph_inches_and_gmt() -> None:
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(request.url.params)
        return httpx.Response(200, json=location([1], [0], [0], [0]))

    client = httpx.Client(transport=httpx.MockTransport(handler))
    fetch_hourly([LatLon(41, -87)], START, START + timedelta(days=2), client)

    assert seen["wind_speed_unit"] == "mph"
    assert seen["precipitation_unit"] == "inch"
    assert seen["timezone"] == "GMT"
    assert seen["start_date"] == "2026-11-03"
    assert seen["end_date"] == "2026-11-05"


def test_service_failure_becomes_a_weather_error() -> None:
    with pytest.raises(WeatherError):
        fetch_hourly([LatLon(41, -87)], START, START, client_for({}, status=500))


def test_timezone_lookup_returns_the_zone() -> None:
    zone = lookup_timezone(
        LatLon(41.88, -87.63), client_for({"timezone": "America/Chicago"})
    )

    assert str(zone) == "America/Chicago"


def test_forecast_window_covers_trip_and_slider() -> None:
    start, end = forecast_window(START, longest_trip_s=3600 * 10, hours_ahead=48)

    assert start == START
    assert end == START + timedelta(hours=58)
