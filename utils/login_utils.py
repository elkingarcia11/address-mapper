import os
import json
from google.cloud import storage
from os import getenv


# Load user data from a JSON file in a Google Cloud Storage Bucket
def download_users_json():
    """Download and decrypt the users.json file from GCS."""
    client = storage.Client()
    bucket = client.bucket(getenv("USERS_BUCKET_NAME"))
    blob = bucket.blob(getenv("USERS_FILE_NAME"))

    return json.loads(blob.download_as_text)
