import os
import json

# Load user data from a JSON file (for simplicity)
USER_DATA_FILE = "users.json"


def load_users():
    if not os.path.exists(USER_DATA_FILE):
        return {}
    with open(USER_DATA_FILE, "r") as file:
        return json.load(file)


def save_users(users):
    with open(USER_DATA_FILE, "w") as file:
        json.dump(users, file)
