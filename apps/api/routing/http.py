"""Retry for the third-party services this API depends on."""

import time
from collections.abc import Callable

import httpx

RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})
ATTEMPTS = 3
BACKOFF_S = 0.5


def send_with_retry(send: Callable[[], httpx.Response]) -> httpx.Response:
    """Call `send`, retrying network errors and overloaded-service responses.

    Waits 0.5 s, then 1 s, between attempts. Other responses, including client
    errors like 400, are returned straight away for the caller to interpret.
    """
    for attempt in range(ATTEMPTS):
        is_last = attempt == ATTEMPTS - 1
        try:
            response = send()
        except httpx.TransportError:
            if is_last:
                raise
        else:
            if is_last or response.status_code not in RETRY_STATUSES:
                return response
        time.sleep(BACKOFF_S * 2**attempt)
    raise AssertionError("unreachable")  # pragma: no cover
