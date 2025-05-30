from flask import Blueprint, request, jsonify
import requests
import re
from os import getenv

# Create a blueprint for extract routes
extract_bp = Blueprint('extract', __name__)

def validate_openai_api_key(api_key):
    """Validate OpenAI API key format"""
    if not api_key:
        return False
    # OpenAI API keys typically start with 'sk-' and are around 51 characters
    return api_key.startswith('sk-') and len(api_key) >= 40

@extract_bp.route('/extract-addresses', methods=['POST'])
def extract_addresses():
    data = request.json
    text = data.get("text", "").strip()
    openai_api_key = data.get("openai_api_key", "").strip()
    
    if not text:
        return jsonify({"error": "No text provided"}), 400
    
    if not openai_api_key:
        return jsonify({"error": "OpenAI API key is required"}), 400
    
    if not validate_openai_api_key(openai_api_key):
        return jsonify({"error": "Invalid OpenAI API key format"}), 400

    try:
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {openai_api_key}",
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
