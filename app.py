from routes.geocode_routes import geocode_bp
from routes.extract_routes import extract_bp
from routes.index_routes import index_bp

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS
import json
import os

# Load environment variables from .env
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# Configure CORS for security
CORS(app, origins=["http://localhost:5001", "http://127.0.0.1:5001"])

# Add security headers
@app.after_request
def after_request(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = "default-src 'self' https://maps.googleapis.com https://api.openai.com; script-src 'self' 'unsafe-inline' https://maps.googleapis.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data: https://maps.gstatic.com https://maps.googleapis.com; connect-src 'self' https://maps.googleapis.com https://api.openai.com"
    return response

# Import and register routes
app.register_blueprint(index_bp)
app.register_blueprint(extract_bp)
app.register_blueprint(geocode_bp)

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5001)
