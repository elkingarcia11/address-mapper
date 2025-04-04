from flask import Blueprint, render_template, request, redirect, url_for, session
from flask.helpers import get_debug_flag
from utils.login_utils import load_users
import json
# Create a blueprint for login routes
login_bp = Blueprint('login', __name__)


@login_bp.route("/logout", methods=["GET", "POST"])
def logout():
    session.pop("username", None)
    return redirect(url_for("login.login"))


@login_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        try:
            users = load_users()

            if username in users and users[username] == password:
                session["username"] = username
                return redirect(url_for("index.index"))
            else:
                return "Invalid username or password", 401
        except:
            return "Invalid username or password", 401
    return render_template("login/login.html")
