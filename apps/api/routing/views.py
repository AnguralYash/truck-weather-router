import json
from datetime import UTC, datetime

from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET, require_POST

from .geometry import LatLon
from .planner import PlanError, PlanRequest, plan_trip


@require_GET
def health(_request: HttpRequest) -> JsonResponse:
    return JsonResponse({"status": "ok"})


@require_POST
def plan(request: HttpRequest) -> JsonResponse:
    try:
        plan_request = parse_plan_request(request.body)
        result = plan_trip(plan_request, now=datetime.now(UTC))
    except PlanError as error:
        return JsonResponse(
            {"error": {"code": error.code, "message": error.message}},
            status=error.status,
        )
    return JsonResponse(result)


def parse_plan_request(body: bytes) -> PlanRequest:
    try:
        data = json.loads(body)
        return PlanRequest(
            origin=_place(data["origin"]),
            destination=_place(data["destination"]),
            departure_local=_departure(data["departure"]),
            load_lb=float(data["load_lb"]),
            spacing_miles=int(data["spacing_miles"]),
        )
    except (ValueError, KeyError, TypeError) as error:
        raise PlanError(
            "invalid_request",
            "The request is missing a field or has a value in the wrong format.",
        ) from error


def _place(value: dict) -> LatLon:
    return LatLon(lat=float(value["lat"]), lon=float(value["lon"]))


def _departure(value: str) -> datetime:
    departure = datetime.fromisoformat(value)
    if departure.tzinfo is not None:
        raise ValueError("Departure must be local time without an offset")
    return departure
