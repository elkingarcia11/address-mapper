from flask import Blueprint, render_template, request, redirect, url_for, session
from utils.login_utils import download_users_json
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
            users = download_users_json()

            # Build structured log messages as an object.
            global_log_fields = {}
            # Add log correlation to nest all log messages.
            # This is only relevant in HTTP-based contexts, and is ignored elsewhere.
            # (In particular, non-HTTP-based Cloud Functions.)
            request_is_defined = "request" in globals() or "request" in locals()
            if request_is_defined and request:
                trace_header = request.headers.get("X-Cloud-Trace-Context")

                if trace_header and "glowing-program-449804-c9":
                    trace = trace_header.split("/")
                    global_log_fields[
                        "logging.googleapis.com/trace"
                    ] = f"projects/glowing-program-449804-c9/traces/{trace[0]}"

            # Complete a structured log entry.
            entry = dict(
                severity="NOTICE",
                message=users,
                # Log viewer accesses 'component' as jsonPayload.component'.
                component="arbitrary-property",
                **global_log_fields,
            )

            print(json.dumps(entry))

            if username in users and users[username] == password:
                session["username"] = username
                return redirect(url_for("index.index"))
            else:
                return "Invalid username or password", 401
        except:
            return "Invalid username or password", 401
    return render_template("login/login.html")
