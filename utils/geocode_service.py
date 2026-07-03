import requests

from utils.geocode_utils import extract_address_fields


def geocode_addresses(addresses, google_maps_geo_api_key):
    """Geocode a list of address strings using the Google Geocoding API."""
    geocoded_results = []

    for address in addresses:
        response = requests.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"address": address, "key": google_maps_geo_api_key},
        )
        if response.status_code != 200:
            geocoded_results.append({
                "address": address,
                "error": f"Geocoding failed: {response.status_code} - {response.text}",
            })
            continue

        result = response.json()
        if result["status"] != "OK":
            geocoded_results.append({
                "address": address,
                "error": f"Geocoding failed: {result['status']}",
            })
            continue

        top_result = result["results"][0]
        location = top_result["geometry"]["location"]
        fields = extract_address_fields(top_result)
        geocoded_results.append({
            "address": address,
            "latitude": location["lat"],
            "longitude": location["lng"],
            "street_address": fields["street_address_1"],
            **fields,
        })

    return geocoded_results
