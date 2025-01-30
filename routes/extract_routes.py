from flask import Blueprint, request, jsonify
import requests
from os import getenv

# Create a blueprint for extract routes
extract_bp = Blueprint('extract', __name__)


@extract_bp.route('/extract-addresses', methods=['POST'])
def extract_addresses():
    data = request.json
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"error": "No text provided"}), 400

    OPENAI_API_KEY = getenv("OPENAI_API_KEY")
    try:
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
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
            addresses = first_choice.get(
                "message", {}).get("content", "").strip()
            return jsonify({"addresses": addresses})
        else:
            return jsonify({"error": "Failed to extract addresses", "details": response.text}), response.status_code
    except Exception as e:
        return jsonify({"error": "Internal server error", "details": str(e)}), 500
