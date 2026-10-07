"""
META ADS PUBLISHER SERVICE (Phase 4 - Meta Ads API Integration)
================================================================
Handles real Meta Marketing API operations (Campaign -> Ad Set -> Ad Creative -> Ad).

SAFETY & COMPLIANCE RULES:
1. Reads credentials exclusively from environment variables — NEVER hardcoded.
2. All Meta objects (Campaign, Ad Set, Ad) are created with status="PAUSED".
3. Zero automatic spending or payment method manipulation.
4. Never logs or prints META_ACCESS_TOKEN.
"""

import os
import json
import requests as http
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()


def _get_meta_ads_creds() -> dict | None:
    """
    Retrieves and validates Meta Ads API credentials from environment.
    Never exposes raw token values.
    """
    token = os.getenv("META_ACCESS_TOKEN", "").strip()
    ad_account_id = os.getenv("META_AD_ACCOUNT_ID", "").strip()
    page_id = os.getenv("META_PAGE_ID", "").strip()
    ig_account_id = os.getenv("INSTAGRAM_BUSINESS_ACCOUNT_ID", "").strip()

    if not token or not ad_account_id:
        return None

    # Ensure ad_account_id starts with "act_"
    if not ad_account_id.startswith("act_"):
        ad_account_id = f"act_{ad_account_id}"

    return {
        "access_token": token,
        "ad_account_id": ad_account_id,
        "page_id": page_id,
        "ig_account_id": ig_account_id,
    }


def _map_objective(objective: str | None) -> str:
    """Maps internal objective to Meta Marketing API outcome enum."""
    obj = (objective or "Awareness").lower()
    if "traffic" in obj:
        return "OUTCOME_TRAFFIC"
    elif "engagement" in obj:
        return "OUTCOME_ENGAGEMENT"
    elif "lead" in obj:
        return "OUTCOME_LEADS"
    elif "sale" in obj or "conversion" in obj:
        return "OUTCOME_SALES"
    elif "app" in obj:
        return "OUTCOME_APP_PROMOTION"
    else:
        return "OUTCOME_AWARENESS"


def _map_cta(cta: str | None) -> str:
    """Maps human readable CTA string to Meta Call To Action Enum."""
    c = (cta or "Learn More").upper().replace(" ", "_")
    valid_ctas = {
        "LEARN_MORE", "SHOP_NOW", "SIGN_UP", "CONTACT_US", "APPLY_NOW",
        "BOOK_NOW", "DOWNLOAD", "GET_OFFER", "WATCH_MORE", "LISTEN_NOW"
    }
    return c if c in valid_ctas else "LEARN_MORE"


from pathlib import Path

def _get_public_image_url(image_path: str | None) -> str:
    """Converts local image path to public HTTPS URL accessible by Meta crawlers."""
    fallback_url = "https://dummyimage.com/1024x1024/6366f1/ffffff.png"
    if not image_path:
        return fallback_url
        
    if image_path.startswith("http://") or image_path.startswith("https://"):
        if "localhost" in image_path or "127.0.0.1" in image_path:
            raise ValueError("A public HTTPS URL is required for Meta publishing. Found localhost/127.0.0.1 in image path.")
        return image_path

    backend_base = os.getenv("BACKEND_BASE_URL", "").rstrip("/")
    if not backend_base:
        raise ValueError("BACKEND_BASE_URL environment variable is missing. A public backend URL (like ngrok) is required for Meta publishing.")
        
    if "localhost" in backend_base or "127.0.0.1" in backend_base:
        raise ValueError(f"BACKEND_BASE_URL '{backend_base}' is invalid for Meta. A public HTTPS URL (like ngrok) is required.")

    if not backend_base.startswith("https://"):
        raise ValueError(f"BACKEND_BASE_URL '{backend_base}' must start with https:// for Meta to access images.")

    clean_path = image_path if image_path.startswith("/") else f"/{image_path}"
    return f"{backend_base}{clean_path}"


def create_meta_campaign(creds: dict, name: str, objective: str) -> dict:
    """
    Creates a Meta Ad Campaign via Graph API.
    CRITICAL: Always created with status="PAUSED".
    """
    url = f"https://graph.facebook.com/v19.0/{creds['ad_account_id']}/campaigns"
    payload = {
        "name": f"{name} (AI SMM Agent)",
        "objective": _map_objective(objective),
        "status": "PAUSED",
        "special_ad_categories": json.dumps(["NONE"]),
        "is_adset_budget_sharing_enabled": "false",
        "access_token": creds["access_token"],
    }

    resp = http.post(url, data=payload, timeout=30)
    data = resp.json()

    if resp.ok and "id" in data:
        print(f"[INFO - meta_ads] Created Meta Campaign ID: {data['id']}")
        return {"success": True, "campaign_id": data["id"]}

    err = data.get("error", {})
    print(f"[ERROR - meta_ads] Campaign creation failed details: {err}")
    return {
        "success": False,
        "error": f"Meta Campaign Error {err.get('code', resp.status_code)}: {err.get('message', 'Unknown error')}",
    }


def _get_ad_account_currency_multiplier(creds: dict) -> int:
    """
    Fetches the ad account currency from Meta API to determine the correct minor unit multiplier.
    Defaults to 100 (e.g., cents) for most currencies.
    """
    url = f"https://graph.facebook.com/v19.0/{creds['ad_account_id']}"
    params = {
        "fields": "currency",
        "access_token": creds["access_token"]
    }
    
    try:
        resp = http.get(url, params=params, timeout=10)
        data = resp.json()
        if resp.ok and "currency" in data:
            currency = data["currency"].upper()
            # Zero-decimal currencies
            if currency in ["JPY", "KRW", "CLP", "PYG", "VND", "VUV", "XAF", "XOF", "XPF"]:
                return 1
            # Three-decimal currencies
            elif currency in ["TND", "BHD", "JOD", "KWD", "OMR"]:
                return 1000
            # Default for USD, EUR, GBP, PKR, etc.
            return 100
    except Exception as e:
        print(f"[WARNING - meta_ads] Failed to fetch ad account currency, defaulting to multiplier 100. Error: {e}")
        
    return 100  # Safe fallback for most major currencies


def create_meta_adset(creds: dict, campaign_id: str, ad) -> dict:
    """
    Creates a Meta Ad Set under the specified Campaign.
    CRITICAL: Always created with status="PAUSED".
    """
    url = f"https://graph.facebook.com/v19.0/{creds['ad_account_id']}/adsets"

    # Fetch currency multiplier to correctly calculate minor units (subunits)
    multiplier = _get_ad_account_currency_multiplier(creds)
    
    # Convert daily budget to sub-units based on account currency (e.g. cents for USD)
    daily_budget = float(ad.daily_budget or 10.0)  # Safe fallback if 0
    budget_subunit = int(daily_budget * multiplier)

    start_time = datetime.utcnow() + timedelta(minutes=5)
    start_time_iso = start_time.strftime("%Y-%m-%dT%H:%M:%S+0000")

    # Construct targeting spec
    geo = {"countries": ["US"]}
    loc_str = (ad.audience_location or "").strip()
    if loc_str and len(loc_str) == 2:
        geo = {"countries": [loc_str.upper()]}

    age_min = max(18, int(ad.audience_age_min or 18))
    age_max = min(65, int(ad.audience_age_max or 65))
    if age_max < age_min:
        age_max = 65

    targeting = {
        "geo_locations": geo,
        "age_min": age_min,
        "age_max": age_max,
        "targeting_automation": {
            "advantage_audience": 0
        }
    }

    payload = {
        "name": f"{ad.name} - Ad Set",
        "campaign_id": campaign_id,
        "daily_budget": budget_subunit,
        "billing_event": "IMPRESSIONS",
        "optimization_goal": "REACH" if _map_objective(ad.objective) == "OUTCOME_AWARENESS" else "LINK_CLICKS",
        "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
        "targeting": json.dumps(targeting),
        "status": "PAUSED",
        "start_time": start_time_iso,
        "access_token": creds["access_token"],
    }

    if creds.get("page_id"):
        payload["promoted_object"] = json.dumps({"page_id": creds["page_id"]})

    resp = http.post(url, data=payload, timeout=30)
    data = resp.json()

    if resp.ok and "id" in data:
        print(f"[INFO - meta_ads] Created Meta Ad Set ID: {data['id']}")
        return {"success": True, "adset_id": data["id"]}

    err = data.get("error", {})
    print(f"[ERROR - meta_ads] Ad Set creation failed details: {err}")
    return {
        "success": False,
        "error": f"Meta AdSet Error {err.get('code', resp.status_code)}: {err.get('message', 'Unknown error')}",
    }


def create_meta_ad_creative(creds: dict, ad) -> dict:
    """
    Creates a Meta Ad Creative (Page / Instagram post story spec).
    """
    url = f"https://graph.facebook.com/v19.0/{creds['ad_account_id']}/adcreatives"

    page_id = creds.get("page_id")
    if not page_id:
        return {"success": False, "error": "META_PAGE_ID is required to create ad creative"}

    image_url = _get_public_image_url(ad.media_path)
    if not image_url:
        # Fallback placeholder image if no media uploaded
        image_url = "https://picsum.photos/1024/1024"

    link_data = {
        "picture": image_url,
        "message": ad.primary_text or ad.name or "Special offer from our business",
        "name": ad.headline or ad.name or "Learn More",
        "call_to_action": {
            "type": _map_cta(ad.cta)
        },
        "link": f"https://facebook.com/{page_id}"
    }

    object_story_spec = {
        "page_id": page_id,
        "link_data": link_data
    }

    payload = {
        "name": f"{ad.name} - Creative",
        "object_story_spec": json.dumps(object_story_spec),
        "access_token": creds["access_token"],
    }

    resp = http.post(url, data=payload, timeout=30)
    data = resp.json()

    if resp.ok and "id" in data:
        print(f"[INFO - meta_ads] Created Meta Ad Creative ID: {data['id']}")
        return {"success": True, "creative_id": data["id"]}

    err = data.get("error", {})
    print(f"[ERROR - meta_ads] Ad Creative creation failed details: {err}")
    return {
        "success": False,
        "error": f"Meta Creative Error {err.get('code', resp.status_code)}: {err.get('message', 'Unknown error')}",
    }


def create_meta_ad(creds: dict, adset_id: str, creative_id: str, ad) -> dict:
    """
    Creates a Meta Ad linking the Ad Set and Ad Creative.
    CRITICAL: Always created with status="PAUSED".
    """
    url = f"https://graph.facebook.com/v19.0/{creds['ad_account_id']}/ads"

    payload = {
        "name": f"{ad.name} - Ad",
        "adset_id": adset_id,
        "creative": json.dumps({"creative_id": creative_id}),
        "status": "PAUSED",
        "access_token": creds["access_token"],
    }

    resp = http.post(url, data=payload, timeout=30)
    data = resp.json()

    if resp.ok and "id" in data:
        print(f"[INFO - meta_ads] Created Meta Ad ID: {data['id']}")
        return {"success": True, "ad_id": data["id"]}

    err = data.get("error", {})
    print(f"[ERROR - meta_ads] Ad creation failed details: {err}")
    return {
        "success": False,
        "error": f"Meta Ad Error {err.get('code', resp.status_code)}: {err.get('message', 'Unknown error')}",
    }


def publish_ad_to_meta(ad) -> dict:
    """
    Main orchestration function to publish a local Ad to Meta Ads Manager.
    
    Flow:
    1. Validate credentials.
    2. Create Campaign (PAUSED)
    3. Create Ad Set (PAUSED)
    4. Create Ad Creative
    5. Create Ad (PAUSED)

    Returns dict with success status, external Meta IDs, and any error message.
    Preserves created IDs on partial failures.
    """
    creds = _get_meta_ads_creds()
    if not creds:
        return {
            "success": False,
            "error": "Meta Ads credentials missing. Ensure META_ACCESS_TOKEN and META_AD_ACCOUNT_ID are configured in backend/.env"
        }

    res_summary = {
        "success": False,
        "meta_ad_account_id": creds["ad_account_id"],
        "meta_campaign_id": getattr(ad, "meta_campaign_id", None),
        "meta_adset_id": getattr(ad, "meta_adset_id", None),
        "meta_creative_id": getattr(ad, "meta_creative_id", None),
        "meta_ad_id": getattr(ad, "meta_ad_id", None),
        "error": None,
    }

    try:
        # Step 1: Create Campaign (if not already created)
        if not res_summary["meta_campaign_id"]:
            camp_res = create_meta_campaign(creds, ad.name, ad.objective)
            if not camp_res["success"]:
                res_summary["error"] = camp_res["error"]
                return res_summary
            res_summary["meta_campaign_id"] = camp_res["campaign_id"]

        # Step 2: Create Ad Set (if not already created)
        if not res_summary["meta_adset_id"]:
            adset_res = create_meta_adset(creds, res_summary["meta_campaign_id"], ad)
            if not adset_res["success"]:
                res_summary["error"] = adset_res["error"]
                return res_summary
            res_summary["meta_adset_id"] = adset_res["adset_id"]

        # Step 3: Create Ad Creative (if not already created)
        if not res_summary["meta_creative_id"]:
            creative_res = create_meta_ad_creative(creds, ad)
            if not creative_res["success"]:
                res_summary["error"] = creative_res["error"]
                return res_summary
            res_summary["meta_creative_id"] = creative_res["creative_id"]

        # Step 4: Create Ad (if not already created)
        if not res_summary["meta_ad_id"]:
            ad_res = create_meta_ad(creds, res_summary["meta_adset_id"], res_summary["meta_creative_id"], ad)
            if not ad_res["success"]:
                res_summary["error"] = ad_res["error"]
                return res_summary
            res_summary["meta_ad_id"] = ad_res["ad_id"]

        # All steps succeeded!
        res_summary["success"] = True
        return res_summary

    except Exception as exc:
        print(f"[ERROR - meta_ads_publisher] Unexpected error during Meta publishing: {exc}")
        res_summary["error"] = f"Unexpected exception: {str(exc)}"
        return res_summary


def create_variation_meta_creative(creds: dict, ad, variation) -> dict:
    """
    Creates a Meta Ad Creative specifically for an Ad Variation.
    """
    url = f"https://graph.facebook.com/v19.0/{creds['ad_account_id']}/adcreatives"

    page_id = creds.get("page_id")
    if not page_id:
        return {"success": False, "error": "META_PAGE_ID is required to create ad creative"}

    image_url = _get_public_image_url(getattr(ad, "media_path", None))
    if not image_url:
        image_url = "https://picsum.photos/1024/1024"

    primary_text = getattr(variation, "primary_text", None) or getattr(ad, "primary_text", None) or getattr(ad, "name", "") or "Special offer"
    headline = getattr(variation, "headline", None) or getattr(ad, "headline", None) or getattr(ad, "name", "") or "Learn More"
    cta_str = getattr(variation, "cta", None) or getattr(ad, "cta", None) or "Learn More"

    link_data = {
        "picture": image_url,
        "message": primary_text,
        "name": headline,
        "call_to_action": {
            "type": _map_cta(cta_str)
        },
        "link": f"https://facebook.com/{page_id}"
    }

    object_story_spec = {
        "page_id": page_id,
        "link_data": link_data
    }

    v_name = getattr(variation, "variation_name", "Variation")
    payload = {
        "name": f"{getattr(ad, 'name', 'Ad')} - Creative ({v_name})",
        "object_story_spec": json.dumps(object_story_spec),
        "access_token": creds["access_token"],
    }

    resp = http.post(url, data=payload, timeout=30)
    data = resp.json()

    if resp.ok and "id" in data:
        print(f"[INFO - meta_ads] Created Meta Variation Creative ID: {data['id']}")
        return {"success": True, "creative_id": data["id"]}

    err = data.get("error", {})
    print(f"[ERROR - meta_ads] Variation Creative creation failed details: {err}")
    return {
        "success": False,
        "error": f"Meta Creative Error {err.get('code', resp.status_code)}: {err.get('message', 'Unknown error')}",
    }


def publish_variation_to_meta(ad, variation) -> dict:
    """
    Publishes a specific Ad Variation as a separate Meta Ad under the parent campaign's Ad Set.
    CRITICAL SAFETY RULES:
    1. The variation Meta Ad is created with status="PAUSED" by default.
    2. Reuses existing parent Campaign & Ad Set IDs.
    3. Prevents duplicate Meta objects if re-tried.
    """
    creds = _get_meta_ads_creds()
    if not creds:
        return {
            "success": False,
            "error": "Meta Ads credentials missing. Ensure META_ACCESS_TOKEN and META_AD_ACCOUNT_ID are configured in backend/.env"
        }

    res_summary = {
        "success": False,
        "meta_creative_id": getattr(variation, "meta_creative_id", None),
        "meta_ad_id": getattr(variation, "meta_ad_id", None),
        "error": None,
    }

    try:
        # Step 1: Ensure parent Ad Campaign and Ad Set exist on Meta
        if not getattr(ad, "meta_adset_id", None):
            parent_pub = publish_ad_to_meta(ad)
            if not parent_pub["success"]:
                res_summary["error"] = f"Parent campaign setup failed: {parent_pub.get('error')}"
                return res_summary
            ad.meta_campaign_id = parent_pub.get("meta_campaign_id")
            ad.meta_adset_id = parent_pub.get("meta_adset_id")

        # Step 2: Create Variation Ad Creative if not already created
        if not res_summary["meta_creative_id"]:
            c_res = create_variation_meta_creative(creds, ad, variation)
            if not c_res["success"]:
                res_summary["error"] = c_res["error"]
                return res_summary
            res_summary["meta_creative_id"] = c_res["creative_id"]

        # Step 3: Create Variation Meta Ad under parent Ad Set if not already created
        if not res_summary["meta_ad_id"]:
            v_name = getattr(variation, "variation_name", "Variation")
            
            class AdWrap:
                def __init__(self, name):
                    self.name = name

            ad_res = create_meta_ad(creds, ad.meta_adset_id, res_summary["meta_creative_id"], AdWrap(f"{ad.name} ({v_name})"))
            if not ad_res["success"]:
                res_summary["error"] = ad_res["error"]
                return res_summary
            res_summary["meta_ad_id"] = ad_res["ad_id"]

        res_summary["success"] = True
        return res_summary

    except Exception as exc:
        print(f"[ERROR - meta_ads_publisher] Unexpected error during Variation Meta publishing: {exc}")
        res_summary["error"] = f"Unexpected exception: {str(exc)}"
        return res_summary

