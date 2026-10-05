"""
META ADS INSIGHTS SERVICE (Phase 5 - Analytics & Performance Metrics)
======================================================================
Fetches live performance insights from Meta Marketing API for:
- Ad Account level
- Campaign level
- Ad Set level
- Ad level

Date Range Presets Supported:
- today
- last_7d
- last_30d
- custom (since & until YYYY-MM-DD)

Calculates & returns:
- impressions, reach, clicks, spend, ctr, cpc, cpm, results

SAFETY RULES:
1. Zero fake data generation — returns has_data=False when no Meta impressions deliver.
2. Credentials loaded exclusively from environment.
3. Safe error handling for expired tokens / Meta API codes.
"""

import os
import json
import requests as http
from dotenv import load_dotenv

load_dotenv()


def _get_meta_creds() -> dict | None:
    token = os.getenv("META_ACCESS_TOKEN", "").strip()
    ad_account_id = os.getenv("META_AD_ACCOUNT_ID", "").strip()
    if not token or not ad_account_id:
        return None

    if not ad_account_id.startswith("act_"):
        ad_account_id = f"act_{ad_account_id}"

    return {
        "access_token": token,
        "ad_account_id": ad_account_id
    }


def _extract_results(actions_list: list | None) -> int:
    """Extracts conversions/results count from Meta actions list."""
    if not actions_list or not isinstance(actions_list, list):
        return 0
    
    total_results = 0
    conversion_types = {
        "offsite_conversion.fb_pixel_purchase", "purchase", "lead", 
        "offsite_conversion.fb_pixel_lead", "link_click", "onsite_conversion.messaging_conversation_started_7d"
    }

    for act in actions_list:
        action_type = act.get("action_type", "")
        value = int(float(act.get("value", 0)))
        if action_type in conversion_types or "conversion" in action_type:
            total_results += value

    return total_results


def fetch_meta_insights(
    object_id: str | None = None,
    object_type: str = "account",
    date_preset: str = "last_7d",
    since: str | None = None,
    until: str | None = None,
) -> dict:
    """
    Fetches real-time performance insights from Meta Marketing API.

    Args:
        object_id: Target Meta object ID (Campaign ID, AdSet ID, Ad ID, or Ad Account ID)
        object_type: "account" | "campaign" | "adset" | "ad"
        date_preset: "today" | "last_7d" | "last_30d" | "custom"
        since: YYYY-MM-DD string for custom range
        until: YYYY-MM-DD string for custom range

    Returns:
        {
            "success": bool,
            "has_data": bool,
            "object_id": str,
            "object_type": str,
            "date_preset": str,
            "metrics": {
                "impressions": int,
                "reach": int,
                "clicks": int,
                "spend": float,
                "ctr": float,
                "cpc": float,
                "cpm": float,
                "results": int,
            },
            "message": str | None,
            "error": str | None,
        }
    """
    creds = _get_meta_creds()
    if not creds:
        return {
            "success": False,
            "has_data": False,
            "metrics": _empty_metrics(),
            "message": "Meta Ads credentials not configured in backend/.env",
            "error": "Missing META_ACCESS_TOKEN or META_AD_ACCOUNT_ID"
        }

    # Determine endpoint target ID
    target_id = (object_id or "").strip()
    if not target_id or object_type == "account":
        target_id = creds["ad_account_id"]

    url = f"https://graph.facebook.com/v19.0/{target_id}/insights"
    
    params = {
        "fields": "impressions,reach,clicks,ctr,spend,cpc,cpm,actions,conversions",
        "access_token": creds["access_token"],
    }

    # Configure date range / preset
    if date_preset in ("today", "last_7d", "last_30d"):
        params["date_preset"] = date_preset
    elif date_preset == "custom" and since and until:
        params["time_range"] = json.dumps({"since": since, "until": until})
    else:
        params["date_preset"] = "last_7d"

    try:
        resp = http.get(url, params=params, timeout=20)
        data = resp.json()

        if not resp.ok:
            err = data.get("error", {})
            err_code = err.get("code", resp.status_code)
            err_msg = err.get("message", "Meta Graph API error")
            print(f"[WARNING - meta_insights] Meta API Insights error code {err_code}: {err_msg}")
            
            return {
                "success": False,
                "has_data": False,
                "object_id": target_id,
                "object_type": object_type,
                "date_preset": date_preset,
                "metrics": _empty_metrics(),
                "message": f"Meta Insights API returned error {err_code}: {err_msg}",
                "error": err_msg,
            }

        insights_list = data.get("data", [])
        if not insights_list:
            # No impressions or delivery data recorded yet
            return {
                "success": True,
                "has_data": False,
                "object_id": target_id,
                "object_type": object_type,
                "date_preset": date_preset,
                "metrics": _empty_metrics(),
                "message": "No performance data yet. Your ad has not started delivering.",
                "error": None,
            }

        # Parse first row of insights data
        row = insights_list[0]
        impressions = int(row.get("impressions", 0))
        reach = int(row.get("reach", 0))
        clicks = int(row.get("clicks", 0))
        spend = float(row.get("spend", 0.0))
        
        # Calculate or parse CTR, CPC, CPM
        ctr = float(row.get("ctr", 0.0))
        if ctr == 0.0 and impressions > 0 and clicks > 0:
            ctr = round((clicks / impressions) * 100, 2)

        cpc = float(row.get("cpc", 0.0))
        if cpc == 0.0 and clicks > 0 and spend > 0:
            cpc = round(spend / clicks, 2)

        cpm = float(row.get("cpm", 0.0))
        if cpm == 0.0 and impressions > 0 and spend > 0:
            cpm = round((spend / impressions) * 1000, 2)

        results = _extract_results(row.get("actions") or row.get("conversions"))

        return {
            "success": True,
            "has_data": True,
            "object_id": target_id,
            "object_type": object_type,
            "date_preset": date_preset,
            "date_start": row.get("date_start"),
            "date_stop": row.get("date_stop"),
            "metrics": {
                "impressions": impressions,
                "reach": reach,
                "clicks": clicks,
                "spend": spend,
                "ctr": round(ctr, 2),
                "cpc": round(cpc, 2),
                "cpm": round(cpm, 2),
                "results": results,
            },
            "message": None,
            "error": None,
        }

    except http.RequestException as req_err:
        print(f"[ERROR - meta_insights] Network error fetching insights: {req_err}")
        return {
            "success": False,
            "has_data": False,
            "object_id": target_id,
            "object_type": object_type,
            "date_preset": date_preset,
            "metrics": _empty_metrics(),
            "message": "Network error connecting to Meta Graph API",
            "error": str(req_err),
        }
    except Exception as exc:
        print(f"[ERROR - meta_insights] Unexpected error in fetch_meta_insights: {exc}")
        return {
            "success": False,
            "has_data": False,
            "object_id": target_id,
            "object_type": object_type,
            "date_preset": date_preset,
            "metrics": _empty_metrics(),
            "message": "Unexpected error parsing Meta Insights",
            "error": str(exc),
        }


def _empty_metrics() -> dict:
    return {
        "impressions": 0,
        "reach": 0,
        "clicks": 0,
        "spend": 0.0,
        "ctr": 0.0,
        "cpc": 0.0,
        "cpm": 0.0,
        "results": 0,
    }
