from flask import Blueprint, request, jsonify

from utils.address_format import validate_sanitized_address_lines
from utils.geocode_service import geocode_addresses

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

    valid_addresses, invalid_addresses = validate_sanitized_address_lines(addresses)
    if not valid_addresses:
        return jsonify({"error": "No addresses provided"}), 400
    if invalid_addresses:
        return jsonify({
            "error": (
                "Each address must use the format: street address, city, ST ZIP "
                "(example: 2249 Washington Ave, Bronx, NY 10456)."
            ),
            "invalid_addresses": invalid_addresses,
        }), 400

    geocoded_results = geocode_addresses(valid_addresses, google_maps_geo_api_key)
    return jsonify({"results": geocoded_results})
