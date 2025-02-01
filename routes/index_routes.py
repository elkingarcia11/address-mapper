from flask import Blueprint, render_template, redirect, url_for, session
from os import getenv

# Create a blueprint for index routes
index_bp = Blueprint('index', __name__)


@index_bp.route('/')
def index():
    if "username" in session:
        google_maps_api_key = getenv("GOOGLE_MAPS_JS_API_KEY")
        return render_template('index/index.html', google_maps_api_key=google_maps_api_key)
    return redirect(url_for("login.login"))
