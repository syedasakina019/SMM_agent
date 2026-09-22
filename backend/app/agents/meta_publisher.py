"""
META PUBLISHER
==============
Handles real publishing to Facebook / Instagram via the Meta Graph API.

Reads credentials exclusively from environment variables — never hardcoded.
Returns a structured result dict so the scheduler can update post status
without knowing any API details.

Supported operations:
  - Photo post to Facebook Page
  - Photo post to Instagram Business Account (container + publish flow)

If credentials are missing or the API call fails, returns success=False
with a safe error message that does NOT expose tokens or secrets.
"""

import os
import requests as http
from dotenv import load_dotenv

load_dotenv()


def _get_meta_creds() -> dict | None:
    """
    Returns Meta credentials from environment, or None if any are missing.
    Never logs or exposes the actual token values.
    """
    token = os.getenv("META_ACCESS_TOKEN", "").strip()
    page_id = os.getenv("META_PAGE_ID", "").strip()
    ig_account_id = os.getenv("INSTAGRAM_BUSINESS_ACCOUNT_ID", "").strip()

    if not token or not page_id:
        return None

    return {
        "access_token": token,
        "page_id": page_id,
        "ig_account_id": ig_account_id,
    }


def _publish_to_facebook(caption: str, image_url: str | None, creds: dict) -> dict:
    """Post a photo (or text) to a Facebook Page."""
    base = f"https://graph.facebook.com/v19.0/{creds['page_id']}"

    if image_url:
        payload = {
            "url": image_url,
            "caption": caption,
            "access_token": creds["access_token"],
        }
        resp = http.post(f"{base}/photos", data=payload, timeout=30)
    else:
        payload = {
            "message": caption,
            "access_token": creds["access_token"],
        }
        resp = http.post(f"{base}/feed", data=payload, timeout=30)

    data = resp.json()
    if resp.ok and ("id" in data or "post_id" in data):
        return {"success": True, "external_id": data.get("id") or data.get("post_id")}

    # Extract safe error message — never include the access token
    err = data.get("error", {})
    return {"success": False, "error": f"Facebook API error {err.get('code', resp.status_code)}: {err.get('message', 'Unknown error')}"}


def _publish_to_instagram(caption: str, image_url: str | None, creds: dict) -> dict:
    """Post a photo to an Instagram Business Account (two-step container flow)."""
    ig_id = creds.get("ig_account_id")
    if not ig_id:
        return {"success": False, "error": "INSTAGRAM_BUSINESS_ACCOUNT_ID not configured"}
    if not image_url:
        return {"success": False, "error": "Instagram requires an image URL"}

    base = f"https://graph.facebook.com/v19.0/{ig_id}"

    # Step 1: Create media container
    container_resp = http.post(
        f"{base}/media",
        data={
            "image_url": image_url,
            "caption": caption,
            "access_token": creds["access_token"],
        },
        timeout=30,
    )
    container_data = container_resp.json()

    if not container_resp.ok or "id" not in container_data:
        err = container_data.get("error", {})
        return {
            "success": False,
            "error": f"Instagram container error {err.get('code', container_resp.status_code)}: {err.get('message', 'Unknown')}",
        }

    container_id = container_data["id"]

    # Step 2: Publish the container
    publish_resp = http.post(
        f"{base}/media_publish",
        data={
            "creation_id": container_id,
            "access_token": creds["access_token"],
        },
        timeout=30,
    )
    publish_data = publish_resp.json()

    if publish_resp.ok and "id" in publish_data:
        return {"success": True, "external_id": publish_data["id"]}

    err = publish_data.get("error", {})
    return {
        "success": False,
        "error": f"Instagram publish error {err.get('code', publish_resp.status_code)}: {err.get('message', 'Unknown')}",
    }


def publish_to_meta(post) -> dict:
    """
    Main entry point called by the scheduler.

    Args:
        post: SQLAlchemy Post ORM object

    Returns:
        {
            "success": bool,
            "external_id": str | None,   # populated on success
            "error": str | None,          # safe message on failure
        }
    """
    creds = _get_meta_creds()
    if creds is None:
        return {
            "success": False,
            "external_id": None,
            "error": "Meta credentials not configured. Set META_ACCESS_TOKEN and META_PAGE_ID in .env",
        }

    caption = post.caption or ""
    # image_path is stored as "/uploads/filename.jpg" — needs to be a public URL for Meta API
    # Build absolute URL using the backend base URL env var, or skip if not set
    backend_base = os.getenv("BACKEND_BASE_URL", "").rstrip("/")
    image_url = f"{backend_base}{post.image_path}" if backend_base and post.image_path else None

    platforms = (post.platforms or "instagram").lower()
    results = {}

    if "facebook" in platforms:
        results["facebook"] = _publish_to_facebook(caption, image_url, creds)

    if "instagram" in platforms:
        results["instagram"] = _publish_to_instagram(caption, image_url, creds)

    if not results:
        # No recognised platform
        return {"success": False, "external_id": None, "error": "No recognised platform specified"}

    # Aggregate: succeed only if ALL targeted platforms succeeded
    all_ok = all(r["success"] for r in results.values())
    external_ids = [r.get("external_id") for r in results.values() if r.get("external_id")]
    errors = [r.get("error") for r in results.values() if r.get("error")]

    return {
        "success": all_ok,
        "external_id": ",".join(external_ids) if external_ids else None,
        "error": "; ".join(errors) if errors else None,
    }
