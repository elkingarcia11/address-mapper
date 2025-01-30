from flask import Blueprint, render_template
from os import getenv

# Create a blueprint for index routes
index_bp = Blueprint('index', __name__)


@index_bp.route('/')
def index():
    google_maps_api_key = getenv("GOOGLE_MAPS_JS_API_KEY")
    return render_template('index.html', google_maps_api_key=google_maps_api_key)
