"""
ADS AGENT (Phase 2 - AI Campaign Generator)
===========================================
Uses Google Gemini API to generate structured ad campaign concepts,
targeting recommendations, budgets, and 3 ad copy variations.
"""

import os
import re
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv
from fastapi import HTTPException

MODEL_NAMES = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-pro-preview",
]


def _get_genai_client() -> genai.Client:
    load_dotenv(override=True)
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="GEMINI_API_KEY is not configured in backend/.env file."
        )
    return genai.Client(api_key=api_key)


def generate_ad_campaign(
    product_service: str = "",
    objective: str = "Awareness",
    platform: str = "instagram,facebook",
    target_audience: str = "",
    campaign_description: str = "",
    daily_budget: float | None = None,
    duration_days: int | None = None,
) -> dict:
    """
    Generates a structured ad campaign JSON matching the specified schema.
    """
    client = _get_genai_client()

    business_name = os.getenv("BUSINESS_NAME", "our business")
    niche = os.getenv("BUSINESS_NICHE", "general products")
    tone = os.getenv("BRAND_TONE", "friendly and professional")

    platform_rules = ""
    p_lower = (platform or "").lower()
    if "instagram" in p_lower and "facebook" in p_lower:
        platform_rules = "Platform: Instagram + Facebook. Write balanced copy that works well with visuals and social feeds."
    elif "instagram" in p_lower:
        platform_rules = "Platform: Instagram. Write concise, engaging, visual-first copy that grabs attention fast."
    else:
        platform_rules = "Platform: Facebook. Write informative, engaging copy that encourages reading and interaction."

    budget_context = f"User target daily budget: ${daily_budget}." if daily_budget else "Suggest a reasonable daily budget."
    duration_context = f"User target duration: {duration_days} days." if duration_days else "Suggest a recommended campaign duration in days."

    prompt = f"""You are an expert social media advertising specialist for "{business_name}", operating in the "{niche}" niche.
Brand tone: {tone}.

Project Info:
- Product/Service: {product_service or niche}
- Objective: {objective}
- {platform_rules}
- Target Audience Info: {target_audience or 'General interested customers'}
- Campaign Description / Notes: {campaign_description or 'No extra notes provided'}
- {budget_context}
- {duration_context}

CRITICAL COPY & TRUTHFULNESS GUIDELINES:
1. Do NOT make misleading or false claims.
2. Do NOT invent fake discounts, guarantees, testimonials, statistics, or product features that were not explicitly provided in the prompt.
3. Write high-converting, realistic copy appropriate for the objective.
4. Provide 3 distinct ad copy variations that are MEANINGFULLY DIFFERENT in approach:
   - Variation 1: Benefit-focused (Highlights key user benefits & value proposition)
   - Variation 2: Problem/Solution-focused (Identifies a customer pain point & presents the solution)
   - Variation 3: Urgency / Offer-focused (Highlights action incentives or limited-time opportunity)

You MUST respond ONLY with valid JSON matching EXACTLY this structure, with no extra code blocks, markup, or commentary outside the JSON:

{{
  "campaign_name": "Suggested short punchy campaign name",
  "primary_copy": "Main ad body copy for the primary version",
  "headline": "Punchy headline for the ad",
  "description": "Short secondary description / sub-headline",
  "cta": "Learn More|Shop Now|Sign Up|Contact Us|Apply Now",
  "audience": {{
    "age_min": 18,
    "age_max": 55,
    "age_range": "18-55",
    "gender": "all|men|women",
    "location": "United States",
    "locations": ["United States"],
    "interests": ["Interest 1", "Interest 2", "Interest 3"],
    "characteristics": "High engagement demographic profile summary"
  }},
  "budget": {{
    "daily": {daily_budget if daily_budget else 15},
    "recommended_duration_days": {duration_days if duration_days else 7}
  }},
  "variations": [
    {{
      "angle": "Benefit-Focused",
      "primary_copy": "Variation 1 body copy highlighting key benefits",
      "headline": "Benefit-driven headline",
      "cta": "Learn More"
    }},
    {{
      "angle": "Problem / Solution",
      "primary_copy": "Variation 2 body copy addressing pain points",
      "headline": "Problem-solving headline",
      "cta": "Shop Now"
    }},
    {{
      "angle": "Urgency & Offer",
      "primary_copy": "Variation 3 body copy creating action urgency",
      "headline": "Action-oriented headline",
      "cta": "Sign Up"
    }}
  ]
}}
"""

    last_error = None

    for model_name in MODEL_NAMES:
        try:
            print(f"[INFO - ads_agent.py] Trying Gemini model: {model_name}")
            response = client.models.generate_content(
                model=model_name,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    temperature=0.75,
                )
            )

            raw_text = response.text
            if not raw_text:
                raise ValueError("Model returned empty text response")

            # Clean markdown JSON formatting
            cleaned_text = raw_text.strip()
            cleaned_text = re.sub(r"^```json\n?", "", cleaned_text, flags=re.IGNORECASE)
            cleaned_text = re.sub(r"^```\n?", "", cleaned_text)
            cleaned_text = re.sub(r"\n?```$", "", cleaned_text)
            cleaned_text = cleaned_text.strip()

            data = json.loads(cleaned_text)

            p_copy = str(data.get("primary_copy") or data.get("primary_text") or "")
            h_line = str(data.get("headline", ""))
            c_cta = str(data.get("cta", "Learn More"))

            raw_variations = data.get("variations") or data.get("ad_variations") or []
            normalized_variations = []

            for idx, v in enumerate(raw_variations):
                v_copy = str(v.get("primary_copy") or v.get("primary_text") or p_copy)
                v_head = str(v.get("headline") or h_line)
                v_cta = str(v.get("cta") or c_cta)
                v_angle = str(v.get("angle") or f"Variation {idx + 1}")
                normalized_variations.append({
                    "angle": v_angle,
                    "primary_copy": v_copy,
                    "primary_text": v_copy,
                    "headline": v_head,
                    "cta": v_cta
                })

            raw_aud = data.get("audience", {})
            age_min = int(raw_aud.get("age_min", 18))
            age_max = int(raw_aud.get("age_max", 65))
            age_range_str = raw_aud.get("age_range") or f"{age_min}-{age_max}"
            loc_str = raw_aud.get("location") or "United States"
            locs_list = raw_aud.get("locations") or [loc_str]

            return {
                "campaign_name": str(data.get("campaign_name", f"{product_service or 'Campaign'} - {objective}")),
                "primary_copy": p_copy,
                "primary_text": p_copy,
                "headline": h_line,
                "description": str(data.get("description", "")),
                "cta": c_cta,
                "audience": {
                    "age_min": age_min,
                    "age_max": age_max,
                    "age_range": age_range_str,
                    "gender": str(raw_aud.get("gender", "all")),
                    "location": loc_str,
                    "locations": locs_list,
                    "interests": list(raw_aud.get("interests", [])),
                    "characteristics": str(raw_aud.get("characteristics", "Targeted audience profile"))
                },
                "budget": {
                    "daily": float(data.get("budget", {}).get("daily", daily_budget or 15)),
                    "recommended_duration_days": int(data.get("budget", {}).get("recommended_duration_days", duration_days or 7))
                },
                "variations": normalized_variations,
                "ad_variations": normalized_variations
            }

        except HTTPException:
            raise
        except json.JSONDecodeError as json_err:
            print(f"[WARNING - ads_agent.py] Invalid JSON from model {model_name}: {json_err}")
            last_error = f"Invalid JSON format returned by AI model: {json_err}"
            continue
        except Exception as e:
            error_msg = str(e)
            print(f"[WARNING - ads_agent.py] Model {model_name} failed: {error_msg}")
            last_error = error_msg

            if any(err in error_msg.lower() for err in ["401", "403", "unauthorized", "api_key"]):
                raise HTTPException(
                    status_code=401,
                    detail=f"Gemini API authentication failed for model {model_name}: {error_msg}"
                )
            continue

    status_code = 429 if (last_error and "429" in last_error) else 503
    raise HTTPException(
        status_code=status_code,
        detail=f"Failed to generate ad campaign with AI models. Last error: {last_error}"
    )


import urllib.request
import urllib.parse
import uuid
import time
from pathlib import Path

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


def generate_ad_creative(
    product_service: str = "",
    objective: str = "Awareness",
    target_audience: str = "",
    headline: str = "",
    primary_text: str = "",
    cta: str = "",
    prompt_description: str = "",
) -> dict:
    """
    Generates a high-quality visual ad creative image matching campaign context
    and saves the file locally in uploads/ directory.
    """
    load_dotenv(override=True)
    business_name = os.getenv("BUSINESS_NAME", "our business")
    niche = os.getenv("BUSINESS_NICHE", "products and services")

    # Construct descriptive image prompt
    prompt_parts = []
    if prompt_description and prompt_description.strip():
        prompt_parts.append(prompt_description.strip())
    else:
        if product_service:
            prompt_parts.append(f"High quality commercial social media ad creative for {product_service}")
        else:
            prompt_parts.append(f"High quality commercial advertisement for {business_name} ({niche})")

        if headline:
            prompt_parts.append(f"Headline concept: '{headline}'")
        if primary_text:
            prompt_parts.append(f"Context: {primary_text[:120]}")
        if target_audience:
            prompt_parts.append(f"Target demographic: {target_audience}")
        if objective:
            prompt_parts.append(f"Objective: {objective}")

    prompt_parts.append("professional photography, eye-catching visual, 4k resolution, modern product design, clean aesthetic, advertising background")
    full_prompt = ", ".join(prompt_parts)

    print(f"[INFO - ads_agent.py] Generating creative image with prompt: {full_prompt!r}")

    # Candidate Image URLs with robust fallback sequence
    encoded_full = urllib.parse.quote(full_prompt)
    encoded_short = urllib.parse.quote(product_service or headline or niche or "advertisement")

    candidate_urls = [
        f"https://image.pollinations.ai/prompt/{encoded_full}?model=turbo&width=1024&height=1024&nologo=true",
        f"https://image.pollinations.ai/prompt/{encoded_short}?width=1024&height=1024",
        "https://picsum.photos/1024/1024"
    ]

    image_bytes = None
    last_err = None

    for url in candidate_urls:
        try:
            print(f"[INFO - ads_agent.py] Fetching creative image from: {url[:70]}...")
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            )
            with urllib.request.urlopen(req, timeout=15) as response:
                if response.status == 200:
                    data = response.read()
                    if data and len(data) > 100:
                        image_bytes = data
                        print(f"[INFO - ads_agent.py] Image fetched successfully ({len(data)} bytes) from provider.")
                        break
        except Exception as exc:
            print(f"[WARNING - ads_agent.py] Image provider attempt failed ({exc}). Retrying next fallback...")
            last_err = str(exc)
            continue

    if not image_bytes:
        print(f"[ERROR - ads_agent.py] All image providers failed. Last error: {last_err}")
        raise HTTPException(
            status_code=502,
            detail=f"Failed to generate visual creative image from providers. Last error: {last_err}"
        )

    filename = f"creative_{int(time.time())}_{uuid.uuid4().hex[:8]}.png"
    file_path = UPLOAD_DIR / filename
    with open(file_path, "wb") as f:
        f.write(image_bytes)

    print(f"[INFO - ads_agent.py] Ad creative saved successfully: /uploads/{filename}")
    return {
        "success": True,
        "media_path": f"/uploads/{filename}",
        "prompt_used": full_prompt,
    }



