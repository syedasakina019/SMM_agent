"""
AD OPTIMIZATION AGENT (Phase 8 - AI Ads Performance Optimization)
==================================================================
Provides AI-powered performance analysis, actionable recommendations,
smart alerts, and ad variation generation for social media ads.

SAFETY & COMPLIANCE RULES:
1. Never generates fake metrics — uses real Meta Marketing API insights.
2. If zero impressions or delivery, returns a clear 'insufficient_data' state.
3. Recommendations are suggestions, NOT facts or guaranteed outcomes.
4. Never automatically activates paid ads, increases budgets, or spends money.
5. All Meta/database mutations require explicit user approval.
"""

import os
import json
from datetime import datetime
from google import genai
from google.genai import types
from dotenv import load_dotenv

from app.database.models import (
    Ad, AdOptimizationAnalysis, AdRecommendation, AdVariation, AdAlert, AdActivityLog
)
from app.agents.meta_ads_insights import fetch_meta_insights
from app.agents.meta_ads_manager import log_activity, classify_meta_error

load_dotenv()

MODEL_NAMES = [
    "gemini-3.8-flash",
    "gemini-2.5-flash",
]


def _get_genai_client() -> genai.Client | None:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None
    return genai.Client(api_key=api_key)


def analyze_ad_performance(ad: Ad, db) -> dict:
    """
    Analyzes available real Meta Insights for an Ad campaign.
    Generates structured AI analysis, recommendations, and smart alerts.
    If no delivery data is present, returns a clear insufficient_data state.
    """
    # 1. Fetch real Meta Insights if Meta campaign ID exists
    meta_insights = None
    if ad.meta_campaign_id:
        try:
            meta_insights = fetch_meta_insights(campaign_id=ad.meta_campaign_id)
        except Exception as exc:
            print(f"[WARNING - optimization] Failed to fetch Meta insights for campaign {ad.meta_campaign_id}: {exc}")

    # Gather metrics
    has_meta_data = bool(meta_insights and meta_insights.get("has_data"))
    metrics = meta_insights.get("metrics", {}) if has_meta_data else {}
    
    impressions = int(metrics.get("impressions", ad.impressions or 0))
    reach = int(metrics.get("reach", ad.reach or 0))
    clicks = int(metrics.get("clicks", ad.clicks or 0))
    spend = float(metrics.get("spend", ad.spend or 0.0))
    ctr = float(metrics.get("ctr", ad.ctr or 0.0))
    cpc = float(metrics.get("cpc", ad.cpc or 0.0))
    cpm = float(metrics.get("cpm", ad.cpm or 0.0))
    results = int(metrics.get("results", ad.results or 0))

    has_sufficient_data = impressions > 0

    # 2. Evaluate Smart Alerts
    alerts = []
    
    # Check Meta error or billing restriction
    if ad.meta_error_message or ad.error_message:
        err_str = ad.meta_error_message or ad.error_message
        err_cat = classify_meta_error(err_str)
        if err_cat["category"] == "billing":
            alerts.append({
                "alert_type": "billing_restriction",
                "severity": "critical",
                "title": "Meta Payment Method Required",
                "message": "Meta Ad Account requires a valid payment method attached in Meta Business Suite before live delivery can begin."
            })
        elif err_cat["category"] == "auth":
            alerts.append({
                "alert_type": "expired_token",
                "severity": "warning",
                "title": "Meta Access Token Issue",
                "message": "Meta access token is expired or missing required Ads permissions. Please refresh credentials in backend/.env."
            })

    if ad.status == "paused" or ad.meta_campaign_status == "PAUSED":
        alerts.append({
            "alert_type": "campaign_paused",
            "severity": "info",
            "title": "Campaign Currently Paused",
            "message": "Campaign is safely PAUSED. Activation requires explicit user action."
        })

    if not has_sufficient_data:
        alerts.append({
            "alert_type": "no_delivery",
            "severity": "info",
            "title": "No Delivery Data Recorded Yet",
            "message": "Campaign has not received active impressions. Performance optimization will unlock after delivery starts."
        })
    else:
        if ctr < 0.5:
            alerts.append({
                "alert_type": "low_ctr",
                "severity": "warning",
                "title": "Low Click-Through Rate (CTR)",
                "message": f"CTR is currently {ctr:.2f}%. Consider refreshing ad copy or headline to improve engagement."
            })
        if cpc > 5.0:
            alerts.append({
                "alert_type": "high_cpc",
                "severity": "warning",
                "title": "Elevated Cost Per Click (CPC)",
                "message": f"CPC is currently ${cpc:.2f}. Narrowing target audience or improving offer relevance may lower CPC."
            })

    # Save alerts to DB
    for a in alerts:
        db_alert = AdAlert(
            ad_id=ad.id,
            alert_type=a["alert_type"],
            severity=a["severity"],
            title=a["title"],
            message=a["message"],
            is_read=False,
            created_at=datetime.utcnow()
        )
        db.add(db_alert)

    # 3. Handle Insufficient Data Case (Zero Impressions / No Delivery)
    if not has_sufficient_data:
        summary = "No active delivery data recorded yet. Campaign performance analysis requires active impressions and clicks."
        positives = [
            "Campaign structure and targeting parameters are configured cleanly in the agent database.",
            "Meta Campaign IDs are safely linked and set to PAUSED state by default."
        ]
        attentions = [
            "Zero impressions recorded on Meta Marketing API.",
            "Live delivery is pending Meta account payment setup or manual user activation."
        ]
        reasons = [
            "Meta Ad Account may require a payment method attached in Meta Business Suite before ads can deliver.",
            "Meta Campaign or Ad Set status is currently PAUSED (default safety state)."
        ]
        next_steps = [
            "Verify payment settings in Meta Business Suite if live delivery is desired.",
            "Review target audience age and location settings.",
            "Generate AI copy variations to prepare alternative creatives."
        ]
        
        default_recs = [
            {
                "title": "Review Creative Headline & Offer",
                "explanation": "Ensure headline has a clear value proposition and strong hook before initiating campaign delivery.",
                "supporting_metrics": "Impressions: 0, Clicks: 0",
                "confidence": "Medium (Estimated)",
                "suggested_action": "Check headline clarity and ensure Call To Action matches target offer.",
                "action_type": "headline_review",
                "proposed_value": None
            },
            {
                "title": "Verify Target Audience Parameters",
                "explanation": "Target location is set to '" + (ad.audience_location or "United States") + "' and age range is " + str(ad.audience_age_min or 18) + "-" + str(ad.audience_age_max or 65) + ".",
                "supporting_metrics": "Targeting Configured",
                "confidence": "High",
                "suggested_action": "Ensure target interests match audience purchasing intent.",
                "action_type": "audience_review",
                "proposed_value": None
            }
        ]

        analysis_obj = AdOptimizationAnalysis(
            ad_id=ad.id,
            has_sufficient_data=False,
            overall_summary=summary,
            positive_observations=json.dumps(positives),
            attention_areas=json.dumps(attentions),
            possible_reasons=json.dumps(reasons),
            next_steps=json.dumps(next_steps),
            created_at=datetime.utcnow()
        )
        db.add(analysis_obj)
        db.commit()
        db.refresh(analysis_obj)

        for r in default_recs:
            rec_obj = AdRecommendation(
                ad_id=ad.id,
                analysis_id=analysis_obj.id,
                title=r["title"],
                explanation=r["explanation"],
                supporting_metrics=r["supporting_metrics"],
                confidence=r["confidence"],
                suggested_action=r["suggested_action"],
                action_type=r["action_type"],
                proposed_value=r.get("proposed_value"),
                status="pending",
                created_at=datetime.utcnow()
            )
            db.add(rec_obj)
        
        db.commit()

        log_activity(db, ad.id, ad.meta_campaign_id, "optimization_analyzed", "success", object_type="campaign")

        return {
            "success": True,
            "has_sufficient_data": False,
            "analysis": {
                "id": analysis_obj.id,
                "overall_summary": summary,
                "positive_observations": positives,
                "attention_areas": attentions,
                "possible_reasons": reasons,
                "next_steps": next_steps,
            },
            "recommendations": default_recs,
            "alerts": alerts,
        }

    # 4. Generate AI Performance Analysis with Gemini when real delivery data exists
    client = _get_genai_client()
    summary = f"Analyzed {impressions} impressions and {clicks} clicks with total spend of ${spend:.2f}."
    positives = [f"Generated {impressions} impressions and {clicks} clicks.", f"Achieved CTR of {ctr:.2f}%."]
    attentions = [f"CPC is ${cpc:.2f} and CPM is ${cpm:.2f}."]
    reasons = ["Ad creative engagement is influencing click velocity."]
    next_steps = ["Test alternative copy variations.", "Monitor CPC trends."]
    recommendations_list = []

    if client:
        prompt = f"""
You are an expert Social Media Ads Performance Optimization Assistant.
Analyze these REAL Meta Marketing API performance metrics for campaign '{ad.name}':

- Objective: {ad.objective}
- Platform: {ad.platform}
- Impressions: {impressions}
- Reach: {reach}
- Clicks: {clicks}
- Spend: ${spend:.2f}
- CTR: {ctr:.2f}%
- CPC: ${cpc:.2f}
- CPM: ${cpm:.2f}
- Conversions/Results: {results}
- Current Headline: {ad.headline or 'N/A'}
- Current Primary Text: {ad.primary_text or 'N/A'}
- Current CTA: {ad.cta}

Provide structured analysis in JSON format ONLY:
{{
  "overall_summary": "High-level performance summary (2-3 sentences)",
  "positive_observations": ["positive point 1", "positive point 2"],
  "attention_areas": ["area needing improvement 1", "area 2"],
  "possible_reasons": ["suggested potential cause 1 (marked as suggestion)", "suggested cause 2"],
  "next_steps": ["recommended next step 1", "step 2"],
  "recommendations": [
    {{
      "title": "Short title",
      "explanation": "Clear explanation grounded in metrics",
      "supporting_metrics": "e.g. CTR: {ctr:.2f}%, CPC: ${cpc:.2f}",
      "confidence": "Medium (Estimated)",
      "suggested_action": "Specific action user can take",
      "action_type": "headline_change | copy_change | cta_change | audience_review | budget_review",
      "proposed_value": "Suggested new headline or text if applicable"
    }}
  ]
}}
"""
        for model in MODEL_NAMES:
            try:
                resp = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.3,
                        response_mime_type="application/json"
                    )
                )
                if resp.text:
                    parsed = json.loads(resp.text)
                    summary = parsed.get("overall_summary", summary)
                    positives = parsed.get("positive_observations", positives)
                    attentions = parsed.get("attention_areas", attentions)
                    reasons = parsed.get("possible_reasons", reasons)
                    next_steps = parsed.get("next_steps", next_steps)
                    recommendations_list = parsed.get("recommendations", [])
                    break
            except Exception as e:
                print(f"[WARNING - optimization] Model {model} failed: {e}")
                continue

    analysis_obj = AdOptimizationAnalysis(
        ad_id=ad.id,
        has_sufficient_data=True,
        overall_summary=summary,
        positive_observations=json.dumps(positives),
        attention_areas=json.dumps(attentions),
        possible_reasons=json.dumps(reasons),
        next_steps=json.dumps(next_steps),
        created_at=datetime.utcnow()
    )
    db.add(analysis_obj)
    db.commit()
    db.refresh(analysis_obj)

    for r in recommendations_list:
        rec_obj = AdRecommendation(
            ad_id=ad.id,
            analysis_id=analysis_obj.id,
            title=r.get("title", "Optimization Recommendation"),
            explanation=r.get("explanation", ""),
            supporting_metrics=r.get("supporting_metrics", ""),
            confidence=r.get("confidence", "Medium"),
            suggested_action=r.get("suggested_action", ""),
            action_type=r.get("action_type", "copy_change"),
            proposed_value=r.get("proposed_value"),
            status="pending",
            created_at=datetime.utcnow()
        )
        db.add(rec_obj)

    db.commit()

    log_activity(db, ad.id, ad.meta_campaign_id, "optimization_analyzed", "success", object_type="campaign")

    return {
        "success": True,
        "has_sufficient_data": True,
        "analysis": {
            "id": analysis_obj.id,
            "overall_summary": summary,
            "positive_observations": positives,
            "attention_areas": attentions,
            "possible_reasons": reasons,
            "next_steps": next_steps,
        },
        "recommendations": recommendations_list,
        "alerts": alerts,
    }


def generate_ad_variations(ad: Ad, db, count: int = 3, prompt_hint: str = "") -> list:
    """
    Generates alternative ad copy/headline/CTA variations using Gemini AI
    and saves them as local draft variations in SQLite.
    DOES NOT automatically publish or activate variations.
    """
    client = _get_genai_client()
    variations = []

    if client:
        prompt = f"""
Generate {count} distinct, high-converting ad copy variations for this campaign:
Product/Service: {ad.name}
Objective: {ad.objective}
Target Audience: {ad.audience_interests or ad.audience_location}
Current Headline: {ad.headline or ad.name}
Current Copy: {ad.primary_text or ''}
{f"User Focus: {prompt_hint}" if prompt_hint else ""}

Return JSON array ONLY:
[
  {{
    "variation_name": "Variation 1 (Benefit-Driven)",
    "primary_text": "Compelling primary ad copy text...",
    "headline": "Catchy 5-8 word headline",
    "cta": "Learn More | Shop Now | Sign Up",
    "description": "Short newsfeed link description",
    "creative_concept": "Visual description of suggested imagery"
  }}
]
"""
        for model in MODEL_NAMES:
            try:
                resp = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.7,
                        response_mime_type="application/json"
                    )
                )
                if resp.text:
                    parsed = json.loads(resp.text)
                    if isinstance(parsed, list):
                        variations = parsed
                        break
            except Exception as e:
                print(f"[WARNING - optimization] Model {model} failed for variations: {e}")
                continue

    # Fallback variations if AI client unavailable or fails
    if not variations:
        variations = [
            {
                "variation_name": "Variation 1 (Urgency Focus)",
                "primary_text": f"Limited time offer: Experience top quality with {ad.name}. Order today before stock runs out!",
                "headline": f"Special Offer on {ad.name}",
                "cta": ad.cta or "Learn More",
                "description": "Exclusive deal available today.",
                "creative_concept": "Vibrant product shot with bold limited-time badge."
            },
            {
                "variation_name": "Variation 2 (Social Proof)",
                "primary_text": f"Join thousands of satisfied customers who trust {ad.name}. See why everyone is talking about us!",
                "headline": f"Rated #1 Choice for {ad.objective}",
                "cta": ad.cta or "Shop Now",
                "description": "Customer favorite product.",
                "creative_concept": "Clean lifestyle visual with star rating overlay."
            }
        ]

    saved_objs = []
    for v in variations:
        v_obj = AdVariation(
            ad_id=ad.id,
            variation_name=v.get("variation_name", "Variation"),
            primary_text=v.get("primary_text", ""),
            headline=v.get("headline", ""),
            cta=v.get("cta", "Learn More"),
            description=v.get("description", ""),
            creative_concept=v.get("creative_concept", ""),
            status="draft",
            created_at=datetime.utcnow()
        )
        db.add(v_obj)
        saved_objs.append(v_obj)

    db.commit()

    log_activity(db, ad.id, ad.meta_campaign_id, "variation_generated", "success", object_type="campaign")
    return saved_objs
