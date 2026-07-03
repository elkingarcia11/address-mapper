from flask import Blueprint, jsonify, request

from routes.geocode_routes import validate_google_maps_api_key
from utils.geocode_service import geocode_addresses
from utils.route_optimizer import Location, optimize_route

optimize_bp = Blueprint("optimize", __name__)


def _to_location(geocoded):
    return Location(
        lat=geocoded["latitude"],
        lng=geocoded["longitude"],
        street_address_1=geocoded.get("street_address_1", ""),
        city=geocoded.get("city", ""),
        state=geocoded.get("state", ""),
        zip=geocoded.get("zip", ""),
    )


@optimize_bp.route("/optimize-route", methods=["POST"])
def optimize_route_endpoint():
    data = request.json or {}
    raw_addresses = data.get("addresses", [])
    google_maps_geo_api_key = data.get("google_maps_geo_api_key", "").strip()
    ors_api_key = data.get("ors_api_key", "").strip()
    profile = data.get("profile", "driving-car")
    time_limit_seconds = int(data.get("time_limit_seconds", 5))

    addresses = [a.strip() for a in raw_addresses if a.strip()]
    if len(addresses) < 2:
        return jsonify({
            "error": "At least two addresses are required (start and end)."
        }), 400

    if not google_maps_geo_api_key:
        return jsonify({"error": "Google Maps Geo API key is required"}), 400

    if not validate_google_maps_api_key(google_maps_geo_api_key):
        return jsonify({"error": "Invalid Google Maps API key format"}), 400

    if not ors_api_key:
        return jsonify({"error": "OpenRouteService API key is required"}), 400

    geocoded = geocode_addresses(addresses, google_maps_geo_api_key)
    failed = [item for item in geocoded if item.get("error")]
    if failed:
        return jsonify({
            "error": "One or more addresses could not be geocoded.",
            "geocoding_errors": failed,
        }), 400

    start = _to_location(geocoded[0])
    end = _to_location(geocoded[-1])
    stops = [_to_location(item) for item in geocoded[1:-1]]

    try:
        result = optimize_route(
            start,
            stops,
            end,
            api_key=ors_api_key,
            profile=profile,
            time_limit_seconds=time_limit_seconds,
        )
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

    ordered_indices = result["ordered_indices"]
    ordered_addresses = [addresses[i] for i in ordered_indices]

    return jsonify({
        "ordered_addresses": ordered_addresses,
        "total_distance_meters": result["total_distance_meters"],
        "total_distance_miles": round(result["total_distance_meters"] / 1609.344, 2),
        "profile": result["profile"],
        "ordered_locations": result["ordered_locations"],
    })
