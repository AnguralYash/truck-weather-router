import httpx
import pytest

from routing.http import ATTEMPTS, send_with_retry


def sender(statuses: list[int | Exception]):
    calls = {"count": 0}

    def send() -> httpx.Response:
        outcome = statuses[min(calls["count"], len(statuses) - 1)]
        calls["count"] += 1
        if isinstance(outcome, Exception):
            raise outcome
        return httpx.Response(outcome)

    return send, calls


def test_a_good_response_is_returned_without_retrying() -> None:
    send, calls = sender([200])

    assert send_with_retry(send).status_code == 200
    assert calls["count"] == 1


def test_overloaded_responses_are_retried_until_one_succeeds() -> None:
    send, calls = sender([503, 429, 200])

    assert send_with_retry(send).status_code == 200
    assert calls["count"] == 3


def test_the_last_overloaded_response_is_returned_after_all_attempts() -> None:
    send, calls = sender([503])

    assert send_with_retry(send).status_code == 503
    assert calls["count"] == ATTEMPTS


def test_client_errors_are_not_retried() -> None:
    send, calls = sender([400])

    assert send_with_retry(send).status_code == 400
    assert calls["count"] == 1


def test_network_errors_are_retried_then_raised() -> None:
    send, calls = sender([httpx.ConnectError("down")])

    with pytest.raises(httpx.ConnectError):
        send_with_retry(send)
    assert calls["count"] == ATTEMPTS


def test_a_network_error_followed_by_success_recovers() -> None:
    send, _ = sender([httpx.ReadTimeout("slow"), 200])

    assert send_with_retry(send).status_code == 200
