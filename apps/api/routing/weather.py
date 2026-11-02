"""Hourly forecasts from Open-Meteo, fetched in parallel batches."""

from collections.abc import Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx

from .geometry import LatLon
from .http import send_with_retry
from .risk import Weather

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
BATCH_SIZE = 100
HOURLY_VARIABLES = "wind_speed_10m,rain,showers,snowfall"


class WeatherError(Exception):
    """The forecast could not be retrieved or does not cover the time asked for."""


@dataclass(frozen=True)
class HourlySeries:
    """A location's hourly weather. `start` is the UTC time of the first hour."""

    start: datetime
    wind_mph: list[float]
    rain_in: list[float]
    snow_in: list[float]

    def at(self, when: datetime) -> Weather:
        """The weather for the hour nearest `when`."""
        hours = round((when - self.start).total_seconds() / 3600)
        if not 0 <= hours < len(self.wind_mph):
            raise WeatherError("The forecast does not cover the requested time.")
        return Weather(
            wind_mph=self.wind_mph[hours],
            rain_in_per_hr=self.rain_in[hours],
            snow_in_per_hr=self.snow_in[hours],
        )


def fetch_hourly(
    points: Sequence[LatLon],
    start: datetime,
    end: datetime,
    client: httpx.Client | None = None,
) -> list[HourlySeries]:
    """Hourly weather for every point, covering the UTC days from `start` to `end`."""
    if not points:
        return []
    batches = [points[i : i + BATCH_SIZE] for i in range(0, len(points), BATCH_SIZE)]
    owns_client = client is None
    http = client or httpx.Client(timeout=30)
    try:
        with ThreadPoolExecutor(max_workers=min(len(batches), 4)) as pool:
            results = pool.map(
                lambda batch: _fetch_batch(batch, start, end, http), batches
            )
            return [series for batch in results for series in batch]
    finally:
        if owns_client:
            http.close()


def _fetch_batch(
    points: Sequence[LatLon], start: datetime, end: datetime, http: httpx.Client
) -> list[HourlySeries]:
    params = {
        "latitude": ",".join(f"{p.lat:.4f}" for p in points),
        "longitude": ",".join(f"{p.lon:.4f}" for p in points),
        "hourly": HOURLY_VARIABLES,
        "wind_speed_unit": "mph",
        "precipitation_unit": "inch",
        "timezone": "GMT",
        "start_date": start.astimezone(UTC).date().isoformat(),
        "end_date": end.astimezone(UTC).date().isoformat(),
    }
    try:
        response = send_with_retry(lambda: http.get(FORECAST_URL, params=params))
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise WeatherError("The weather service is not available.") from error
    # A single location comes back as an object, several as a list.
    locations = payload if isinstance(payload, list) else [payload]
    return [_to_series(location["hourly"]) for location in locations]


def _to_series(hourly: dict) -> HourlySeries:
    start = datetime.fromisoformat(hourly["time"][0]).replace(tzinfo=UTC)
    return HourlySeries(
        start=start,
        wind_mph=[_number(v) for v in hourly["wind_speed_10m"]],
        rain_in=[
            _number(rain) + _number(showers)
            for rain, showers in zip(hourly["rain"], hourly["showers"], strict=True)
        ],
        snow_in=[_number(v) for v in hourly["snowfall"]],
    )


def _number(value: float | None) -> float:
    return 0.0 if value is None else float(value)


_TIMEZONES: dict[tuple[float, float], ZoneInfo] = {}


def lookup_timezone(point: LatLon, client: httpx.Client | None = None) -> ZoneInfo:
    """The IANA time zone at a location, used to read the local departure time.

    Results are kept for the life of the process, keyed to about a kilometre.
    """
    key = (round(point.lat, 2), round(point.lon, 2))
    if key in _TIMEZONES:
        return _TIMEZONES[key]
    params = {
        "latitude": f"{point.lat:.4f}",
        "longitude": f"{point.lon:.4f}",
        "timezone": "auto",
        "forecast_days": 1,
        "hourly": "temperature_2m",
    }
    http = client or httpx.Client(timeout=15)
    try:
        response = send_with_retry(lambda: http.get(FORECAST_URL, params=params))
        response.raise_for_status()
        zone = ZoneInfo(response.json()["timezone"])
    except (httpx.HTTPError, ValueError, KeyError) as error:
        raise WeatherError("The time zone could not be determined.") from error
    finally:
        if client is None:
            http.close()
    _TIMEZONES[key] = zone
    return zone


def forecast_window(
    departure: datetime, longest_trip_s: float, hours_ahead: int
) -> tuple[datetime, datetime]:
    """The UTC span to fetch: from departure to the end of the trip plus the slider."""
    return departure, departure + timedelta(seconds=longest_trip_s, hours=hours_ahead)
