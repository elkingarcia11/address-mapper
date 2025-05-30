from flask import Blueprint, request, jsonify
import requests
from os import getenv
from utils.geocode_utils import extract_street_address

# Create a blueprint for geocode routes
geocode_bp = Blueprint('geocode', __name__)

def validate_google_maps_api_key(api_key):
    """Validate Google Maps API key format"""
    if not api_key:
        return False
    # Google Maps API keys typically start with 'AIza' and are 39 characters long
    return api_key.startswith('AIza') and len(api_key) == 39

@geocode_bp.route('/geocode', methods=['POST'])
def geocode():
    data = request.json
    addresses = data.get("addresses", [])
    google_maps_geo_api_key = data.get("google_maps_geo_api_key", "").strip()
    
    if not addresses:
        return jsonify({"error": "No addresses provided"}), 400
    
    if not google_maps_geo_api_key:
        return jsonify({"error": "Google Maps Geo API key is required"}), 400
    
    if not validate_google_maps_api_key(google_maps_geo_api_key):
        return jsonify({"error": "Invalid Google Maps API key format"}), 400

    geocoded_results = []

    for address in addresses:
        response = requests.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"address": address, "key": google_maps_geo_api_key}
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
