import pytest

from routing import weather


@pytest.fixture(autouse=True)
def no_waiting_and_clean_caches(monkeypatch: pytest.MonkeyPatch) -> None:
    """Retries should not slow the tests down, and one test's cache must not leak."""
    monkeypatch.setattr("routing.http.time.sleep", lambda _seconds: None)
    weather._TIMEZONES.clear()
