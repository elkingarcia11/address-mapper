from flask import Blueprint, render_template
from os import getenv

# Create a blueprint for index routes
index_bp = Blueprint('index', __name__)

@index_bp.route('/')
def index():
    return render_template('index/index.html')
