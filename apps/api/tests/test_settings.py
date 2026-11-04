import importlib

import pytest

from config import settings


def reload_settings() -> object:
    return importlib.reload(settings)


@pytest.fixture(autouse=True)
def restore_settings(monkeypatch: pytest.MonkeyPatch):
    """Reloading settings must not leave test values behind for other tests."""
    yield
    monkeypatch.undo()
    importlib.reload(settings)


def test_the_secret_key_comes_from_the_environment_when_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DJANGO_SECRET_KEY", "my-own-key")

    assert reload_settings().SECRET_KEY == "my-own-key"


def test_without_one_a_random_key_is_made_and_no_fixed_key_ships(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("DJANGO_SECRET_KEY", raising=False)

    first = reload_settings().SECRET_KEY
    second = reload_settings().SECRET_KEY

    assert len(first) >= 50
    assert first != second
    assert "insecure" not in first


def test_debug_is_off_unless_asked_for(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DJANGO_DEBUG", raising=False)
    assert reload_settings().DEBUG is False

    monkeypatch.setenv("DJANGO_DEBUG", "1")
    assert reload_settings().DEBUG is True
