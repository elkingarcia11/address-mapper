from flask import Flask, render_template_string
import os
from dotenv import load_dotenv

# Load API key from .env
load_dotenv()
API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

app = Flask(__name__)

# Load the HTML file dynamically
@app.route('/')
def index():
    with open("index.html", "r") as file:
        html_content = file.read().replace("GOOGLE_MAPS_API_KEY", API_KEY)
    return render_template_string(html_content)

if __name__ == "__main__":
    app.run(debug=True)
