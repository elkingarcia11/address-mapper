from routes.geocode_routes import geocode_bp
from routes.extract_routes import extract_bp
from routes.login_routes import login_bp
from routes.index_routes import index_bp

from dotenv import load_dotenv
from flask import Flask
import json
import os
import secrets


# Load environment variables from .env
load_dotenv()


# Initialize Flask app
app = Flask(__name__)
app.secret_key = secrets.token_hex(32)  # Required for session management

# Import and register routes
app.register_blueprint(index_bp)
app.register_blueprint(login_bp)
app.register_blueprint(extract_bp)
app.register_blueprint(geocode_bp)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
