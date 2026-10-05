import os
import hashlib
import glob
from dotenv import dotenv_values, find_dotenv, load_dotenv

def get_hash(val):
    if not val:
        return "None"
    return hashlib.sha256(val.encode()).hexdigest()[:8]

print("--- DIAGNOSING META_ACCESS_TOKEN ---")

os_token = os.environ.get("META_ACCESS_TOKEN")
print(f"OS-level (System) META_ACCESS_TOKEN present: {os_token is not None}")
if os_token:
    print(f"OS-level token length: {len(os_token)}, hash: {get_hash(os_token)}")

env_file_path = find_dotenv()
print(f"Dotenv file found at: {env_file_path}")

if env_file_path:
    env_values = dotenv_values(env_file_path)
    file_token = env_values.get("META_ACCESS_TOKEN")
    print(f"File-level META_ACCESS_TOKEN present in {env_file_path}: {file_token is not None}")
    if file_token:
        print(f"File-level token length: {len(file_token)}, hash: {get_hash(file_token)}")

load_dotenv(override=False)
loaded_token = os.environ.get("META_ACCESS_TOKEN")
print(f"After load_dotenv(override=False), token length: {len(loaded_token) if loaded_token else 'None'}, hash: {get_hash(loaded_token)}")

load_dotenv(override=True)
loaded_token_override = os.environ.get("META_ACCESS_TOKEN")
print(f"After load_dotenv(override=True), token length: {len(loaded_token_override) if loaded_token_override else 'None'}, hash: {get_hash(loaded_token_override)}")

print("Other .env files in backend/: ", glob.glob(".env*"))
print("Other .env files in parent dir: ", glob.glob("../.env*"))
