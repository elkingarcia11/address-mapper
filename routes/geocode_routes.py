from flask import Blueprint, request, jsonify
import requests
from os import getenv
from utils.geocode_utils import extract_street_address

# Create a blueprint for geocode routes
geocode_bp = Blueprint('geocode', __name__)


@geocode_bp.route('/geocode', methods=['POST'])
def geocode():
    data = request.json
    addresses = data.get("addresses", [])
    if not addresses:
        return jsonify({"error": "No addresses provided"}), 400

    GOOGLE_MAPS_GEO_API_KEY = getenv("GOOGLE_MAPS_GEO_API_KEY")
    geocoded_results = []

    for address in addresses:
        response = requests.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"address": address, "key": GOOGLE_MAPS_GEO_API_KEY}
        )
        if response.status_code == 200:
            result = response.json()
            if result["status"] == "OK":
                location = result["results"][0]["geometry"]["location"]
                street_address = extract_street_address(result["results"][0])
                geocoded_results.append({
                    "address": address,
                    "latitude": location["lat"],
                    "longitude": location["lng"],
                    "street_address": street_address
                })
            else:
                geocoded_results.append({
                    "address": address,
                    "error": f"Geocoding failed: {result['status']}"
                })
        else:
            geocoded_results.append({
                "address": address,
                "error": f"Geocoding failed: {response.status_code} - {response.text}"
            })

    return jsonify({"results": geocoded_results})
