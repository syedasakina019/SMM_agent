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


def fetch_instagram_user_info(igsid: str) -> dict:
    """
    Looks up an Instagram user's username/name via their Instagram-scoped ID (IGSID).
    Called after receiving a DM webhook to resolve the sender's real identity.

    Returns:
        {
            "username": str | None,
            "name": str | None,
        }
    Never raises — returns empty dict on any failure.
    """
    creds = _get_meta_creds()
    if not creds or not igsid:
        return {"username": None, "name": None}

    try:
        url = f"https://graph.facebook.com/v19.0/{igsid}"
        params = {
            "fields": "username,name",
            "access_token": creds["access_token"],
        }
        resp = http.get(url, params=params, timeout=10)
        data = resp.json()

        if resp.ok and ("username" in data or "name" in data):
            username = data.get("username")
            name = data.get("name")
            print(f"[INFO - meta] Resolved IGSID {igsid} → username={username!r} name={name!r}")
            return {"username": username, "name": name}

        err = data.get("error", {})
        print(f"[WARNING - meta] Could not resolve IGSID {igsid}: {err.get('code')} {err.get('message', 'unknown')}")
        return {"username": None, "name": None}

    except Exception as exc:
        print(f"[WARNING - meta] fetch_instagram_user_info failed for {igsid}: {exc}")
        return {"username": None, "name": None}


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
    if post.image_path and (post.image_path.startswith("http://") or post.image_path.startswith("https://")):
        image_url = post.image_path
    else:
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


def reply_to_meta_comment(comment_id: str, message: str) -> dict:
    """
    Replies to a Facebook or Instagram comment via Meta Graph API.

    Args:
        comment_id: Target comment ID to reply to
        message: Text content of the reply

    Returns:
        {"success": bool, "external_id": str | None, "error": str | None}
    """
    creds = _get_meta_creds()
    if not creds:
        return {"success": False, "external_id": None, "error": "Meta credentials not configured. Set META_ACCESS_TOKEN and META_PAGE_ID in .env"}

    if not comment_id:
        return {"success": False, "external_id": None, "error": "Missing target comment_id for reply"}
    if not message or not message.strip():
        return {"success": False, "external_id": None, "error": "Reply message content cannot be empty"}

    # Instagram Graph API uses /{comment_id}/replies to reply to a comment.
    # Facebook Page Graph API uses /{comment_id}/comments.
    # Try /replies first (Instagram), then fallback to /comments (Facebook).
    url_replies = f"https://graph.facebook.com/v19.0/{comment_id}/replies"
    payload = {
        "message": message,
        "access_token": creds["access_token"],
    }

    try:
        resp = http.post(url_replies, data=payload, timeout=30)
        data = resp.json()

        meta_err = data.get("error") if not resp.ok else None
        is_ok = resp.ok and ("id" in data or "comment_id" in data)
        print(f"\n==================== [INSTAGRAM OUTGOING COMMENT REPLY] ====================", flush=True)
        print(f"target comment_id: {comment_id}", flush=True)
        print(f"endpoint: {url_replies}", flush=True)
        print(f"http_status: {resp.status_code}", flush=True)
        print(f"success: {is_ok}", flush=True)
        safe_response = {k: v for k, v in data.items() if k != "access_token"}
        print(f"meta_response: {safe_response}", flush=True)
        if meta_err:
            print(f"META ERROR CODE: {meta_err.get('code')}", flush=True)
            print(f"META ERROR MESSAGE: {meta_err.get('message')}", flush=True)
            print(f"META ERROR TYPE: {meta_err.get('type')}", flush=True)
        print(f"===========================================================================\n", flush=True)

        if is_ok:
            return {"success": True, "external_id": data.get("id") or data.get("comment_id"), "error": None}

        # Fallback to /comments endpoint for Facebook Page comments
        url_comments = f"https://graph.facebook.com/v19.0/{comment_id}/comments"
        resp_comments = http.post(url_comments, data=payload, timeout=30)
        data_comments = resp_comments.json()
        is_comments_ok = resp_comments.ok and ("id" in data_comments or "comment_id" in data_comments)

        print(f"[COMMENT REPLY - FALLBACK /comments]", flush=True)
        print(f"endpoint: {url_comments}", flush=True)
        print(f"http_status: {resp_comments.status_code}", flush=True)
        print(f"success: {is_comments_ok}", flush=True)
        print(f"meta_response: {data_comments}", flush=True)

        if is_comments_ok:
            return {"success": True, "external_id": data_comments.get("id") or data_comments.get("comment_id"), "error": None}

        err = data.get("error", {})
        err_code = err.get("code", resp.status_code)
        err_msg = err.get("message", "Unknown Meta API error")
        return {"success": False, "external_id": None, "error": f"Meta Comment API error {err_code}: {err_msg}"}

    except http.RequestException as req_err:
        return {"success": False, "external_id": None, "error": f"Network error connecting to Meta Graph API: {req_err}"}
    except Exception as exc:
        return {"success": False, "external_id": None, "error": f"Unexpected error during comment reply: {exc}"}


def send_meta_direct_message(recipient_id: str, message: str) -> dict:
    """
    Sends a Direct Message (Instagram / Messenger) via Meta Graph API.

    Args:
        recipient_id: Target user IGSID / PSID
        message: Text content of the direct message

    Returns:
        {"success": bool, "external_id": str | None, "error": str | None}
    """
    creds = _get_meta_creds()
    if not creds:
        return {"success": False, "external_id": None, "error": "Meta credentials not configured. Set META_ACCESS_TOKEN and META_PAGE_ID in .env"}

    if not recipient_id:
        return {"success": False, "external_id": None, "error": "Missing recipient_id for direct message"}
    if not message or not message.strip():
        return {"success": False, "external_id": None, "error": "Direct message content cannot be empty"}

    send_id = creds.get("page_id")
    url = f"https://graph.facebook.com/v19.0/{send_id}/messages"

    payload = {
        "recipient": {"id": recipient_id},
        "message": {"text": message},
        "access_token": creds["access_token"],
    }

    try:
        resp = http.post(url, json=payload, timeout=30)
        data = resp.json()

        meta_err = data.get("error") if not resp.ok else None
        is_ok = resp.ok and ("message_id" in data or "id" in data)
        print(f"\n==================== [INSTAGRAM OUTGOING DM] ====================", flush=True)
        print(f"recipient_id: {recipient_id}", flush=True)
        print(f"endpoint: {url}", flush=True)
        print(f"http_status: {resp.status_code}", flush=True)
        print(f"success: {is_ok}", flush=True)
        safe_response = {k: v for k, v in data.items() if k != "access_token"}
        print(f"meta_response: {safe_response}", flush=True)
        if meta_err:
            print(f"META ERROR CODE: {meta_err.get('code')}", flush=True)
            print(f"META ERROR MESSAGE: {meta_err.get('message')}", flush=True)
            print(f"META ERROR TYPE: {meta_err.get('type')}", flush=True)
            if "error_subcode" in meta_err:
                print(f"META ERROR SUBCODE: {meta_err.get('error_subcode')}", flush=True)
        print(f"=================================================================\n", flush=True)

        if is_ok:
            msg_id = data.get("message_id") or data.get("id")
            return {"success": True, "external_id": msg_id, "error": None}

        err = data.get("error", {})
        err_code = err.get("code", resp.status_code)
        err_msg = err.get("message", "Unknown Meta API error")
        return {"success": False, "external_id": None, "error": f"Meta DM API error {err_code}: {err_msg}"}

    except http.RequestException as req_err:
        print(f"[ERROR - meta] Network error in send_meta_direct_message: {req_err}", flush=True)
        return {"success": False, "external_id": None, "error": f"Network error connecting to Meta Graph API: {req_err}"}
    except Exception as exc:
        print(f"[ERROR - meta] Unexpected error in send_meta_direct_message: {exc}", flush=True)
        return {"success": False, "external_id": None, "error": f"Unexpected error during DM send: {exc}"}


