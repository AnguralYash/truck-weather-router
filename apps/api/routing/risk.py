"""Classify weather at a checkpoint into a risk level.

Thresholds follow the brief's risk table. Where adjacent ranges share a boundary
value (for example rain "0.10-0.25" and "0.25-0.50"), the lower bound belongs to
the higher level, except No Travel, which the brief defines as strictly greater
than its threshold for rain and snow and as "at or above" for wind.
"""

from dataclasses import dataclass
from enum import IntEnum


class RiskLevel(IntEnum):
    LOW = 1
    MODERATE = 2
    HIGH = 3
    SEVERE = 4
    NO_TRAVEL = 5


# Load rules from the brief, in pounds and miles per hour.
HEAVY_LOAD_NO_TRAVEL_LB = 30_000
HEAVY_LOAD_NO_TRAVEL_MIN_WIND_MPH = 45
VERY_HEAVY_LOAD_SEVERE_LB = 40_000
VERY_HEAVY_LOAD_SEVERE_MIN_WIND_MPH = 35


@dataclass(frozen=True)
class Weather:
    wind_mph: float
    rain_in_per_hr: float
    snow_in_per_hr: float


@dataclass(frozen=True)
class Assessment:
    """Risk at one checkpoint: the overall level and each factor's level."""

    level: RiskLevel
    wind: RiskLevel
    rain: RiskLevel
    snow: RiskLevel


def wind_level(mph: float) -> RiskLevel:
    if mph >= 55:
        return RiskLevel.NO_TRAVEL
    if mph >= 45:
        return RiskLevel.SEVERE
    if mph >= 35:
        return RiskLevel.HIGH
    if mph >= 25:
        return RiskLevel.MODERATE
    return RiskLevel.LOW


def rain_level(inches_per_hr: float) -> RiskLevel:
    if inches_per_hr > 1.00:
        return RiskLevel.NO_TRAVEL
    if inches_per_hr >= 0.50:
        return RiskLevel.SEVERE
    if inches_per_hr >= 0.25:
        return RiskLevel.HIGH
    if inches_per_hr >= 0.10:
        return RiskLevel.MODERATE
    return RiskLevel.LOW


def snow_level(inches_per_hr: float) -> RiskLevel:
    if inches_per_hr > 3.0:
        return RiskLevel.NO_TRAVEL
    if inches_per_hr >= 2.0:
        return RiskLevel.SEVERE
    if inches_per_hr >= 1.0:
        return RiskLevel.HIGH
    if inches_per_hr >= 0.5:
        return RiskLevel.MODERATE
    return RiskLevel.LOW


def wind_level_for_load(mph: float, load_lb: float) -> RiskLevel:
    """Wind level after the load rules, which can only raise the level."""
    level = wind_level(mph)
    if mph >= HEAVY_LOAD_NO_TRAVEL_MIN_WIND_MPH and load_lb > HEAVY_LOAD_NO_TRAVEL_LB:
        return max(level, RiskLevel.NO_TRAVEL)
    if (
        mph >= VERY_HEAVY_LOAD_SEVERE_MIN_WIND_MPH
        and load_lb > VERY_HEAVY_LOAD_SEVERE_LB
    ):
        return max(level, RiskLevel.SEVERE)
    return level


def assess(weather: Weather, load_lb: float) -> Assessment:
    """The checkpoint's risk is the worst of its wind, rain, and snow levels."""
    wind = wind_level_for_load(weather.wind_mph, load_lb)
    rain = rain_level(weather.rain_in_per_hr)
    snow = snow_level(weather.snow_in_per_hr)
    return Assessment(level=max(wind, rain, snow), wind=wind, rain=rain, snow=snow)
