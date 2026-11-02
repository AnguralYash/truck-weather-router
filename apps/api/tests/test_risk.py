import pytest

from routing.risk import (
    RiskLevel,
    Weather,
    assess,
    rain_level,
    snow_level,
    wind_level,
    wind_level_for_load,
)

CALM = Weather(wind_mph=0, rain_in_per_hr=0, snow_in_per_hr=0)


@pytest.mark.parametrize(
    ("mph", "expected"),
    [
        (0, RiskLevel.LOW),
        (24.9, RiskLevel.LOW),
        (25, RiskLevel.MODERATE),
        (34.9, RiskLevel.MODERATE),
        (35, RiskLevel.HIGH),
        (44.9, RiskLevel.HIGH),
        (45, RiskLevel.SEVERE),
        (54.9, RiskLevel.SEVERE),
        (55, RiskLevel.NO_TRAVEL),
        (80, RiskLevel.NO_TRAVEL),
    ],
)
def test_wind_thresholds(mph: float, expected: RiskLevel) -> None:
    assert wind_level(mph) == expected


@pytest.mark.parametrize(
    ("rate", "expected"),
    [
        (0.09, RiskLevel.LOW),
        (0.10, RiskLevel.MODERATE),
        (0.25, RiskLevel.HIGH),
        (0.50, RiskLevel.SEVERE),
        (1.00, RiskLevel.SEVERE),
        (1.01, RiskLevel.NO_TRAVEL),
    ],
)
def test_rain_thresholds(rate: float, expected: RiskLevel) -> None:
    assert rain_level(rate) == expected


@pytest.mark.parametrize(
    ("rate", "expected"),
    [
        (0.49, RiskLevel.LOW),
        (0.5, RiskLevel.MODERATE),
        (1.0, RiskLevel.HIGH),
        (2.0, RiskLevel.SEVERE),
        (3.0, RiskLevel.SEVERE),
        (3.01, RiskLevel.NO_TRAVEL),
    ],
)
def test_snow_thresholds(rate: float, expected: RiskLevel) -> None:
    assert snow_level(rate) == expected


def test_wind_55_is_no_travel_for_any_load() -> None:
    assert wind_level_for_load(55, load_lb=0) == RiskLevel.NO_TRAVEL


def test_wind_45_to_54_with_load_over_30000_is_no_travel() -> None:
    assert wind_level_for_load(50, load_lb=30_001) == RiskLevel.NO_TRAVEL


def test_wind_45_to_54_with_load_at_30000_stays_severe() -> None:
    assert wind_level_for_load(50, load_lb=30_000) == RiskLevel.SEVERE


def test_wind_35_to_44_with_load_over_40000_is_severe() -> None:
    assert wind_level_for_load(40, load_lb=40_001) == RiskLevel.SEVERE


def test_wind_35_to_44_with_load_at_40000_stays_high() -> None:
    assert wind_level_for_load(40, load_lb=40_000) == RiskLevel.HIGH


def test_heavy_load_does_not_raise_light_wind() -> None:
    assert wind_level_for_load(20, load_lb=80_000) == RiskLevel.LOW


def test_checkpoint_risk_is_worst_of_the_three_factors() -> None:
    weather = Weather(wind_mph=30, rain_in_per_hr=0.3, snow_in_per_hr=0.6)

    result = assess(weather, load_lb=10_000)

    assert result.wind == RiskLevel.MODERATE
    assert result.rain == RiskLevel.HIGH
    assert result.snow == RiskLevel.MODERATE
    assert result.level == RiskLevel.HIGH


def test_load_rule_raises_checkpoint_risk() -> None:
    weather = Weather(wind_mph=40, rain_in_per_hr=0, snow_in_per_hr=0)

    assert assess(weather, load_lb=20_000).level == RiskLevel.HIGH
    assert assess(weather, load_lb=45_000).level == RiskLevel.SEVERE


def test_calm_weather_is_low() -> None:
    assert assess(CALM, load_lb=80_000).level == RiskLevel.LOW
