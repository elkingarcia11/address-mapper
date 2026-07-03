from flask import Blueprint, jsonify, request

from routes.geocode_routes import validate_google_maps_api_key
from utils.address_format import validate_sanitized_address_lines
from utils.geocode_service import geocode_addresses
from utils.route_optimizer import (
    Location,
    optimize_balanced_multi_route,
    optimize_multi_route,
    optimize_route,
)

try:
    from openrouteservice.exceptions import ApiError as OrsApiError
except ImportError:
    OrsApiError = None

optimize_bp = Blueprint("optimize", __name__)


def _normalize_api_key(value: str) -> str:
    return value.strip().strip("'\"")


def _to_location(geocoded):
    return Location(
        lat=geocoded["latitude"],
        lng=geocoded["longitude"],
        street_address_1=geocoded.get("street_address_1", ""),
        city=geocoded.get("city", ""),
        state=geocoded.get("state", ""),
        zip=geocoded.get("zip", ""),
    )


def _parse_route_capacities(raw_capacities) -> list[int] | None:
    if raw_capacities is None:
        return None
    if not isinstance(raw_capacities, list):
        raise ValueError("route_capacities must be a list of positive integers.")
    if not raw_capacities:
        raise ValueError("route_capacities must include at least one route.")
    capacities: list[int] = []
    for value in raw_capacities:
        try:
            capacity = int(value)
        except (TypeError, ValueError) as exc:
            raise ValueError(
                "Each route capacity must be a positive integer."
            ) from exc
        if capacity < 1:
            raise ValueError("Each route must have at least one stop.")
        capacities.append(capacity)
    return capacities


def _parse_num_routes(raw_num_routes) -> int:
    try:
        num_routes = int(raw_num_routes)
    except (TypeError, ValueError) as exc:
        raise ValueError("num_routes must be a positive integer.") from exc
    if num_routes < 1:
        raise ValueError("num_routes must be at least 1.")
    return num_routes


def _parse_address_lines(raw_lines) -> list[str]:
    if not isinstance(raw_lines, list):
        return []
    return [line.strip() for line in raw_lines if isinstance(line, str) and line.strip()]


def _resolve_optimize_inputs(data: dict) -> tuple[str, str, list[str]]:
    start_address = (data.get("start_address") or "").strip()
    end_address = (data.get("end_address") or "").strip()
    stop_lines = _parse_address_lines(data.get("stops"))
    legacy_addresses = _parse_address_lines(data.get("addresses"))

    if not stop_lines and len(legacy_addresses) > 1:
        stop_lines = legacy_addresses[1:]

    if not start_address and legacy_addresses:
        start_address = legacy_addresses[0]
    if not end_address and legacy_addresses:
        end_address = legacy_addresses[0]

    return start_address, end_address, stop_lines


@optimize_bp.route("/optimize-route", methods=["POST"])
def optimize_route_endpoint():
    data = request.json or {}
    google_maps_geo_api_key = _normalize_api_key(
        data.get("google_maps_geo_api_key", "")
    )
    ors_api_key = _normalize_api_key(data.get("ors_api_key", ""))
    profile = data.get("profile", "driving-car")
    split_mode = data.get("split_mode", "manual")
    route_capacities = data.get("route_capacities")
    num_routes = data.get("num_routes")

    if split_mode not in {"manual", "balanced_distance"}:
        return jsonify({
            "error": "split_mode must be 'manual' or 'balanced_distance'.",
        }), 400

    balanced_mode = split_mode == "balanced_distance"
    multi_route = balanced_mode or route_capacities is not None
    default_time_limit = 30 if multi_route else 5
    time_limit_seconds = int(data.get("time_limit_seconds", default_time_limit))

    start_address, end_address, stop_lines = _resolve_optimize_inputs(data)

    if multi_route:
        if not start_address or not end_address:
            return jsonify({
                "error": "Start and end addresses are required.",
            }), 400
        if not stop_lines:
            return jsonify({
                "error": "At least one stop address is required.",
            }), 400
        if start_address.casefold() != end_address.casefold():
            return jsonify({
                "error": (
                    "Multi-route optimization requires the same start and end "
                    "address for every route."
                ),
            }), 400
    elif not start_address or not end_address:
        return jsonify({
            "error": "Start and end addresses are required.",
        }), 400

    addresses_to_validate = [start_address]
    if end_address.casefold() != start_address.casefold():
        addresses_to_validate.append(end_address)
    addresses_to_validate.extend(stop_lines)

    valid_addresses, invalid_addresses = validate_sanitized_address_lines(
        addresses_to_validate
    )
    if invalid_addresses:
        return jsonify({
            "error": (
                "Each address must use the format: street address, city, ST ZIP "
                "(ZIP optional; example: 2249 Washington Ave, Bronx, NY 10456 "
                "or 1101 Forest Ave, Bronx, NY)."
            ),
            "invalid_addresses": invalid_addresses,
        }), 400

    if not multi_route and len(valid_addresses) < 2:
        return jsonify({
            "error": "At least two addresses are required (start and end)."
        }), 400

    if not google_maps_geo_api_key:
        return jsonify({"error": "Google Maps Geo API key is required"}), 400

    if not validate_google_maps_api_key(google_maps_geo_api_key):
        return jsonify({"error": "Invalid Google Maps API key format"}), 400

    if not ors_api_key:
        return jsonify({"error": "OpenRouteService API key is required"}), 400

    geocoded = geocode_addresses(valid_addresses, google_maps_geo_api_key)
    failed = [item for item in geocoded if item.get("error")]
    if failed:
        return jsonify({
            "error": "One or more addresses could not be geocoded.",
            "geocoding_errors": failed,
        }), 400

    locations = [_to_location(item) for item in geocoded]
    start = locations[0]
    if end_address.casefold() == start_address.casefold():
        end = start
        stops = locations[1:]
    else:
        end = locations[1]
        stops = locations[2:]

    try:
        if multi_route:
            depot = start

            if balanced_mode:
                if num_routes is None:
                    return jsonify({
                        "error": "num_routes is required when split_mode is balanced_distance.",
                    }), 400
                parsed_num_routes = _parse_num_routes(num_routes)
                if parsed_num_routes > len(stops):
                    return jsonify({
                        "error": (
                            f"Cannot create {parsed_num_routes} routes with only "
                            f"{len(stops)} stop(s). Each route needs at least one stop."
                        ),
                        "total_stops": len(stops),
                        "num_routes": parsed_num_routes,
                    }), 400

                result = optimize_balanced_multi_route(
                    depot,
                    stops,
                    parsed_num_routes,
                    api_key=ors_api_key,
                    profile=profile,
                    time_limit_seconds=time_limit_seconds,
                )
            else:
                parsed_capacities = _parse_route_capacities(route_capacities)
                if sum(parsed_capacities) != len(stops):
                    return jsonify({
                        "error": (
                            "Route capacities must sum to the number of stops "
                            f"({len(stops)})."
                        ),
                        "total_stops": len(stops),
                        "capacity_sum": sum(parsed_capacities),
                        "route_capacities": parsed_capacities,
                    }), 400

                result = optimize_multi_route(
                    depot,
                    stops,
                    parsed_capacities,
                    api_key=ors_api_key,
                    profile=profile,
                    time_limit_seconds=time_limit_seconds,
                )
        else:
            result = optimize_route(
                start,
                stops,
                end,
                api_key=ors_api_key,
                profile=profile,
                time_limit_seconds=time_limit_seconds,
            )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        if OrsApiError is not None and isinstance(exc, OrsApiError):
            return jsonify({
                "error": (
                    "OpenRouteService denied the request. Verify your API key is "
                    "valid, includes Matrix API access, and that your daily quota "
                    "has not been exceeded."
                ),
                "details": str(exc),
            }), 403
        if "403" in str(exc) and "disallowed" in str(exc).lower():
            return jsonify({
                "error": (
                    "OpenRouteService denied the request. Verify your API key is "
                    "valid, includes Matrix API access, and that your daily quota "
                    "has not been exceeded."
                ),
                "details": str(exc),
            }), 403
        return jsonify({"error": str(exc)}), 500

    if multi_route:
        routes_payload = []
        for route in result["routes"]:
            routes_payload.append({
                "route_number": route["route_number"],
                "target_stops": route["target_stops"],
                "ordered_stop_labels": route["ordered_stop_labels"],
                "ordered_locations": route["ordered_locations"],
                "distance_meters": route["distance_meters"],
                "distance_miles": round(route["distance_meters"] / 1609.344, 2),
            })

        response_payload = {
            "mode": "multi",
            "split_mode": result.get("split_mode", "manual"),
            "start_label": start.label,
            "end_label": end.label,
            "depot_label": start.label,
            "depot": result["depot"],
            "routes": routes_payload,
            "route_capacities": result["route_capacities"],
            "total_distance_meters": result["total_distance_meters"],
            "total_distance_miles": round(
                result["total_distance_meters"] / 1609.344, 2
            ),
            "profile": result["profile"],
        }
        if result.get("num_routes") is not None:
            response_payload["num_routes"] = result["num_routes"]
        return jsonify(response_payload)

    ordered_indices = result["ordered_indices"]
    ordered_addresses = [locations[i].label for i in ordered_indices]

    return jsonify({
        "mode": "single",
        "ordered_addresses": ordered_addresses,
        "total_distance_meters": result["total_distance_meters"],
        "total_distance_miles": round(result["total_distance_meters"] / 1609.344, 2),
        "profile": result["profile"],
        "ordered_locations": result["ordered_locations"],
    })
