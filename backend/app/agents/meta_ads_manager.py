"""
META ADS MANAGEMENT SERVICE (Phase 6 - Meta Ads Management & Control)
======================================================================
Provides management & status control over already created Meta Marketing API objects:
- Pause Meta Campaign / Ad Set / Ad
- Resume Meta Campaign / Ad Set / Ad
- Get Meta Object Status & Effective Status
- Sync Meta Statuses into local database

SAFETY & COMPLIANCE RULES:
1. Operates ONLY on objects with valid existing Meta IDs.
2. Never creates duplicate campaigns.
3. Never logs or exposes META_ACCESS_TOKEN.
4. Converts Meta API error codes into human-friendly messages.
"""

import os
import requests as http
from datetime import datetime
from dotenv import load_dotenv
from app.database.models import AdActivityLog

load_dotenv()


def _get_meta_creds() -> dict | None:
    token = os.getenv("META_ACCESS_TOKEN", "").strip()
    if not token:
        return None
    return {"access_token": token}


def update_meta_object_status(object_id: str, target_status: str) -> dict:
    """
    Updates the status of a Meta Marketing object (Campaign, AdSet, or Ad) to PAUSED or ACTIVE.

    Args:
        object_id: Meta object ID (e.g., campaign_id, adset_id, ad_id)
        target_status: "PAUSED" or "ACTIVE"

    Returns:
        {"success": bool, "object_id": str, "status": str, "error": str | None}
    """
    creds = _get_meta_creds()
    if not creds:
        return {
            "success": False,
            "object_id": object_id,
            "status": None,
            "error": "META_ACCESS_TOKEN is not configured in backend/.env"
        }

    if not object_id or not object_id.strip():
        return {
            "success": False,
            "object_id": object_id,
            "status": None,
            "error": "Invalid or missing Meta Object ID"
        }

    status_upper = (target_status or "PAUSED").upper()
    if status_upper not in ("PAUSED", "ACTIVE"):
        status_upper = "PAUSED"

    url = f"https://graph.facebook.com/v19.0/{object_id}"
    payload = {
        "status": status_upper,
        "access_token": creds["access_token"],
    }

    try:
        resp = http.post(url, data=payload, timeout=20)
        data = resp.json()

        if resp.ok and data.get("success") is True:
            print(f"[INFO - meta_manager] Meta Object ID={object_id} status updated to {status_upper}")
            return {
                "success": True,
                "object_id": object_id,
                "status": status_upper.lower(),
                "error": None,
            }

        err = data.get("error", {})
        err_code = err.get("code", resp.status_code)
        err_msg = err.get("message", "Meta API update failed")
        
        # User-friendly error mapping
        friendly_error = f"Meta API Error {err_code}: {err_msg}"
        if err_code == 190:
            friendly_error = "Meta Access Token is expired or invalid. Please refresh token."
        elif err_code == 200:
            friendly_error = "Missing Ads Management permissions to update this object."
        elif "payment" in err_msg.lower() or "billing" in err_msg.lower():
            friendly_error = "Meta Ad Account requires a valid payment method before activation."

        print(f"[ERROR - meta_manager] Failed to update object {object_id}: {friendly_error}")
        return {
            "success": False,
            "object_id": object_id,
            "status": None,
            "error": friendly_error,
        }

    except Exception as exc:
        print(f"[ERROR - meta_manager] Exception updating object {object_id}: {exc}")
        return {
            "success": False,
            "object_id": object_id,
            "status": None,
            "error": f"Network or server exception: {str(exc)}",
        }


def get_meta_object_status(object_id: str) -> dict:
    """
    Fetches current status and effective_status of a Meta object via Graph API.
    """
    creds = _get_meta_creds()
    if not creds or not object_id:
        return {"success": False, "status": None, "effective_status": None, "error": "Missing credentials or ID"}

    url = f"https://graph.facebook.com/v19.0/{object_id}"
    params = {
        "fields": "id,name,status,effective_status",
        "access_token": creds["access_token"],
    }

    try:
        resp = http.get(url, params=params, timeout=15)
        data = resp.json()

        if resp.ok and "status" in data:
            return {
                "success": True,
                "object_id": object_id,
                "status": data.get("status", "").lower(),
                "effective_status": data.get("effective_status", "").lower(),
                "name": data.get("name"),
                "error": None,
            }

        err = data.get("error", {})
        return {
            "success": False,
            "object_id": object_id,
            "status": None,
            "effective_status": None,
            "error": err.get("message", "Failed to fetch object status"),
        }

    except Exception as exc:
        return {"success": False, "object_id": object_id, "status": None, "effective_status": None, "error": str(exc)}


def classify_meta_error(error_msg: str | None) -> dict:
    """
    Classifies Meta API error messages into actionable categories:
    - billing: Payment / billing restriction on Meta account.
    - auth: Expired access token or missing API permissions.
    - temporary: Transient network / rate-limit issues (safe to retry).
    - config: Permanent payload / configuration errors.
    """
    if not error_msg:
        return {"category": "none", "is_retryable": True, "user_message": "No error recorded."}

    msg_lower = error_msg.lower()

    if "payment" in msg_lower or "billing" in msg_lower or "1359188" in msg_lower:
        return {
            "category": "billing",
            "is_retryable": False,
            "user_message": "Meta Ad Account requires a valid payment method attached before live delivery can begin."
        }

    if "expired" in msg_lower or "token" in msg_lower or "190" in msg_lower:
        return {
            "category": "auth",
            "is_retryable": False,
            "user_message": "Meta Access Token is expired or invalid. Fresh token required in backend/.env."
        }

    if "permission" in msg_lower or "200" in msg_lower:
        return {
            "category": "auth",
            "is_retryable": False,
            "user_message": "Missing required Ads permissions (ads_management / ads_read)."
        }

    if "rate limit" in msg_lower or "timeout" in msg_lower or "connection" in msg_lower or "500" in msg_lower:
        return {
            "category": "temporary",
            "is_retryable": True,
            "user_message": "Temporary network or Meta API rate limit. System will retry automatically."
        }

    return {
        "category": "config",
        "is_retryable": True,
        "user_message": error_msg
    }


def log_activity(db, ad_id: int, meta_object_id: str | None, action: str, status: str, error_message: str | None = None, object_type: str = "campaign"):
    """
    Helper function to record an entry in ad_activity_logs table.
    """
    try:
        log_entry = AdActivityLog(
            ad_id=ad_id,
            meta_object_id=meta_object_id,
            object_type=object_type,
            action=action,
            status=status,
            error_message=error_message,
            timestamp=datetime.utcnow()
        )
        db.add(log_entry)
        db.commit()
    except Exception as exc:
        print(f"[WARNING - meta_manager] Failed to log activity: {exc}")
        db.rollback()


def sync_ad_meta_status(ad, db) -> dict:
    """
    Queries Meta Marketing API for the local Ad's synced Meta IDs (Campaign, AdSet, Ad)
    and updates the local database status fields to match.
    """
    results = {
        "campaign": None,
        "adset": None,
        "ad": None,
        "errors": []
    }

    # 1. Sync Campaign
    if ad.meta_campaign_id:
        camp_res = get_meta_object_status(ad.meta_campaign_id)
        if camp_res["success"]:
            st = (camp_res["effective_status"] or camp_res["status"] or "PAUSED").upper()
            results["campaign"] = st
            ad.meta_campaign_status = st
        else:
            results["errors"].append(f"Campaign: {camp_res['error']}")

    # 2. Sync Ad Set
    if ad.meta_adset_id:
        adset_res = get_meta_object_status(ad.meta_adset_id)
        if adset_res["success"]:
            st = (adset_res["effective_status"] or adset_res["status"] or "PAUSED").upper()
            results["adset"] = st
            ad.meta_adset_status = st
        else:
            results["errors"].append(f"AdSet: {adset_res['error']}")

    # 3. Sync Ad
    if ad.meta_ad_id:
        ad_res = get_meta_object_status(ad.meta_ad_id)
        if ad_res["success"]:
            st = (ad_res["effective_status"] or ad_res["status"] or "PAUSED").upper()
            results["ad"] = st
            ad.meta_ad_status = st
        else:
            results["errors"].append(f"Ad: {ad_res['error']}")

    # Update local Ad status if any status returned
    primary_meta_status = results["ad"] or results["adset"] or results["campaign"]
    ad.last_synced_at = datetime.utcnow()

    if primary_meta_status:
        meta_s = primary_meta_status.lower()
        if "paused" in meta_s:
            ad.status = "paused"
            ad.meta_publish_status = "published"
        elif "active" in meta_s or "in_process" in meta_s:
            ad.status = "active"
            ad.meta_publish_status = "published"
        elif "archived" in meta_s or "deleted" in meta_s:
            ad.status = "completed"

        ad.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(ad)

        log_activity(db, ad.id, ad.meta_campaign_id, "sync_status", "success", object_type="campaign")
        return {
            "success": True, 
            "statuses": results, 
            "ad_status": ad.status, 
            "last_synced_at": ad.last_synced_at.isoformat() if ad.last_synced_at else None,
            "campaign_status": ad.meta_campaign_status,
            "adset_status": ad.meta_adset_status,
            "ad_status": ad.meta_ad_status,
        }

    err_str = "; ".join(results["errors"]) if results["errors"] else "No Meta IDs linked to sync"
    ad.meta_error_message = err_str
    db.commit()

    log_activity(db, ad.id, ad.meta_campaign_id, "sync_status", "failed", err_str, object_type="campaign")
    return {"success": False, "statuses": results, "error": err_str}


def auto_sync_all_ads(db) -> dict:
    """
    Background job function to automatically synchronize Meta statuses and refresh insights
    for all published campaigns.
    """
    from app.database.models import Ad
    from app.agents.meta_ads_insights import fetch_meta_insights

    published_ads = db.query(Ad).filter(Ad.meta_campaign_id != None).all()
    if not published_ads:
        return {"synced_count": 0, "message": "No published Meta ads to sync"}

    synced_count = 0
    errors = []

    for ad in published_ads:
        try:
            # Sync object statuses
            sync_res = sync_ad_meta_status(ad, db)
            if sync_res["success"]:
                synced_count += 1
                # Periodically refresh performance metrics from Meta API
                insights_res = fetch_meta_insights(campaign_id=ad.meta_campaign_id)
                if insights_res.get("has_data") and insights_res.get("metrics"):
                    m = insights_res["metrics"]
                    ad.spend = float(m.get("spend", ad.spend or 0.0))
                    ad.results = int(m.get("results", ad.results or 0))
                    db.commit()
            else:
                errors.append(f"Ad {ad.id}: {sync_res.get('error')}")
        except Exception as exc:
            errors.append(f"Ad {ad.id} exception: {exc}")

    print(f"[INFO - meta_manager] Auto-synced {synced_count}/{len(published_ads)} Meta ads.")
    return {"synced_count": synced_count, "total_ads": len(published_ads), "errors": errors}


def retry_publish_ad(ad, db) -> dict:
    """
    Safe retry operation for failed Meta publishing attempts.
    Reuses existing Meta IDs (meta_campaign_id, meta_adset_id, etc.) to prevent duplicate Meta object creation.
    """
    from app.agents.meta_ads_publisher import publish_ad_to_meta

    if ad.meta_publish_status == "published" and ad.meta_campaign_id and ad.meta_ad_id:
        return {
            "success": True,
            "message": "Ad campaign is already fully published to Meta Ads Manager.",
            "ad": ad
        }

    ad.meta_publish_status = "publishing"
    ad.meta_error_message = None
    db.commit()

    log_activity(db, ad.id, ad.meta_campaign_id, "retry_publish", "started", object_type="campaign")

    res = publish_ad_to_meta(ad)

    if res.get("success"):
        ad.meta_ad_account_id = res.get("meta_ad_account_id")
        ad.meta_campaign_id = res.get("meta_campaign_id")
        ad.meta_adset_id = res.get("meta_adset_id")
        ad.meta_creative_id = res.get("meta_creative_id")
        ad.meta_ad_id = res.get("meta_ad_id")
        ad.meta_publish_status = "published"
        ad.meta_published_at = datetime.utcnow()
        ad.meta_error_message = None
        ad.last_synced_at = datetime.utcnow()
        ad.status = "paused"  # Safe default: PAUSED
        db.commit()
        db.refresh(ad)

        log_activity(db, ad.id, ad.meta_campaign_id, "retry_publish", "success", object_type="campaign")
        return {"success": True, "ad": ad, "message": "Successfully retried & published to Meta Ads Manager (PAUSED)!"}
    else:
        err_msg = res.get("error", "Failed to publish campaign to Meta Ads Manager.")
        ad.meta_publish_status = "failed"
        ad.meta_error_message = err_msg
        db.commit()

        log_activity(db, ad.id, ad.meta_campaign_id, "retry_publish", "failed", err_msg, object_type="campaign")
        return {"success": False, "error": err_msg}

