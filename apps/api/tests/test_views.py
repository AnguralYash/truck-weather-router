import json

import pytest
from django.test import Client

from routing import views
from routing.planner import PlanError

BODY = {
    "origin": {"lat": 41.88, "lon": -87.63},
    "destination": {"lat": 38.63, "lon": -90.2},
    "departure": "2026-11-03T12:00",
    "load_lb": 42000,
    "spacing_miles": 25,
}


def post(payload: object) -> object:
    return Client().post(
        "/api/plan", data=json.dumps(payload), content_type="application/json"
    )


def test_health_returns_ok() -> None:
    response = Client().get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_plan_passes_the_parsed_request_to_the_planner(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen = {}

    def fake_plan(request, now):
        seen["request"] = request
        return {"ok": True}

    monkeypatch.setattr(views, "plan_trip", fake_plan)

    response = post(BODY)

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert seen["request"].load_lb == 42000
    assert seen["request"].spacing_miles == 25
    assert seen["request"].departure_local.hour == 12


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {**BODY, "load_lb": "heavy"},
        {**BODY, "departure": "tomorrow"},
        {**BODY, "departure": "2026-11-03T12:00:00+05:00"},
        {**BODY, "origin": {"lat": 41}},
    ],
)
def test_malformed_requests_get_a_400(payload: dict) -> None:
    response = post(payload)

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_request"


def test_invalid_json_gets_a_400() -> None:
    response = Client().post("/api/plan", data="{nope", content_type="application/json")

    assert response.status_code == 400


def test_planner_errors_use_their_status_and_code(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def failing(_request, now):
        raise PlanError("trip_too_long", "Too far.", 422)

    monkeypatch.setattr(views, "plan_trip", failing)

    response = post(BODY)

    assert response.status_code == 422
    assert response.json() == {
        "error": {"code": "trip_too_long", "message": "Too far."}
    }


def test_plan_only_accepts_post() -> None:
    assert Client().get("/api/plan").status_code == 405
