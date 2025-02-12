from os import path, getenv, environ
import json
from google.cloud import storage
import sys


def is_running_with_gunicorn():
    return "gunicorn" in sys.argv[0] or "gunicorn" in environ.get("SERVER_SOFTWARE", "")


# Load user data from a JSON file in a Google Cloud Storage Bucket or in the local directory
def load_users():
    if is_running_with_gunicorn():
        """Download and decrypt the users.json file from GCS."""
        client = storage.Client()
        bucket = client.bucket(getenv("USERS_BUCKET_NAME"))
        blob = bucket.blob(getenv("USERS_FILE_NAME"))

        return json.loads(blob.download_as_text)
    else:
        USER_DATA_FILE = "users.json"
        if not path.exists(USER_DATA_FILE):
            return {}
        with open(USER_DATA_FILE, "r") as file:
            return json.load(file)
