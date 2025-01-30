from flask import Flask, request, jsonify, render_template
import requests
import os
from dotenv import load_dotenv

# Load API keys from .env
load_dotenv()

GOOGLE_MAPS_GEO_API_KEY = os.getenv("GOOGLE_MAPS_GEO_API_KEY")
GOOGLE_MAPS_JS_API_KEY = os.getenv("GOOGLE_MAPS_JS_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not GOOGLE_MAPS_GEO_API_KEY or not GOOGLE_MAPS_JS_API_KEY or not OPENAI_API_KEY:
    raise ValueError("Missing required API keys in .env file")

app = Flask(__name__)


# Load the HTML file dynamically
@app.route('/')
def index():
    return render_template('index.html', google_maps_api_key=GOOGLE_MAPS_JS_API_KEY)


@app.route('/extract-addresses', methods=['POST'])
def extract_addresses():
    data = request.json
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"error": "No text provided"}), 400
    try:
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",  # Correct URL without extra space
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OPENAI_API_KEY}",
            },
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "user",
                        "content": f"Extract only the addresses from the following text, excluding any names or other details. The extracted addresses should include the street name, street number, city, state, and zip code, formatted correctly: \n\n{text}\n\nAddresses:"
                    }
                ]
            },
        )

        if response.status_code == 200:
            result = response.json()
            choices = result.get("choices", [])
            if not choices:
                return jsonify({"error": "No choices returned by OpenAI"}), 500

            first_choice = choices[0]
            if "message" in first_choice:
                addresses = first_choice.get(
                    "message", {}).get("content", "").strip()
            else:
                addresses = first_choice.get("text", "").strip()

            return jsonify({"addresses": addresses})
        else:
            return jsonify({"error": "Failed to extract addresses", "details": response.text}), response.status_code
    except Exception as e:
        return jsonify({"error": "Internal server error", "details": str(e)}), 500


@app.route('/geocode', methods=['POST'])
def geocode():
    data = request.json
    addresses = data.get("addresses", [])
    if not addresses:
        return jsonify({"error": "No addresses provided"}), 400

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


def extract_street_address(result):
    """Extracts the street address from the geocoding result."""
    address_components = result["address_components"]
    street_number = next(
        (c["long_name"]
         for c in address_components if "street_number" in c["types"]), ""
    )
    route = next(
        (c["long_name"]
         for c in address_components if "route" in c["types"]), ""
    )
    street_address = f"{street_number} {route}".strip()
    if not street_address:
        print("Warning: Could not extract street address for %s",
              result['formatted_address'])

    return street_address


if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG") == "1")
