"""
CONTENT AGENT (Phase 1 - Image-Aware)
=======================================
Google Gemini API use karta hai (free tier). Ye image ko "dekh" kar
caption + hashtags likhta hai (Vision capability), aur ek text-only
fallback bhi deta hai.
"""

import os
import re
from google import genai
from google.genai import types
from dotenv import load_dotenv
from fastapi import HTTPException

# Primary model: gemini-3.8-flash, followed by valid 3.x fallback models
MODEL_NAMES = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-pro-preview",
]


def _get_genai_client() -> genai.Client:
    """
    Reads GEMINI_API_KEY from backend/.env dynamically and initializes client.
    Raises HTTPException 401 if API key is missing.
    """
    load_dotenv(override=True)
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="GEMINI_API_KEY is not configured in backend/.env file."
        )
    return genai.Client(api_key=api_key)


def _parse_response(text_output: str) -> dict:
    try:
        print(f"\n[DEBUG - content_agent.py] Raw Gemini text length: {len(text_output)}")

        text = text_output.strip()
        text = re.sub(r"^```[a-zA-Z]*\n", "", text)
        text = re.sub(r"\n```$", "", text)
        text = text.strip()

        caption_match = re.search(r"\*?\*?CAPTION:\*?\*?\s*(.*?)(?=\*?\*?HASHTAGS:\*?\*?|$)", text, re.DOTALL | re.IGNORECASE)
        hashtags_match = re.search(r"\*?\*?HASHTAGS:\*?\*?\s*(.*)", text, re.DOTALL | re.IGNORECASE)

        caption = caption_match.group(1).strip() if caption_match else ""
        hashtags_text = hashtags_match.group(1).strip() if hashtags_match else ""

        hashtags = re.findall(r"(#\w+)", hashtags_text)
        
        if not caption and not hashtags:
            caption = text

        return {"caption": caption, "hashtags": hashtags}
    except Exception as e:
        print(f"[ERROR - content_agent.py] Parse Error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse AI response: {str(e)}"
        )


def generate_caption_from_image(image_bytes: bytes, media_type: str, extra_instructions: str = None) -> dict:
    """
    Image ko Gemini ko bhejta hai, jo image dekh kar caption/hashtags likhta hai.

    Args:
        image_bytes: uploaded image ki raw bytes
        media_type: "image/jpeg" ya "image/png"
        extra_instructions: optional extra instruction
    """
    client = _get_genai_client()

    business_name = os.getenv("BUSINESS_NAME", "our business")
    niche = os.getenv("BUSINESS_NICHE", "general products")
    tone = os.getenv("BRAND_TONE", "friendly and professional")

    instruction_line = (
        f"Additional instruction from the business owner: {extra_instructions}"
        if extra_instructions else ""
    )

    prompt = f"""You are writing an Instagram/Facebook post for "{business_name}", a business in the "{niche}" niche.
Target audience: Your followers and potential customers.
Brand tone: {tone}.

Task: Look closely at the attached image. Write a natural, human-sounding caption that specifically describes or relates to the actual visual details (colors, mood, product, setting). 

CRITICAL GUIDELINES:
1. Be authentic and engaging. Write like a real human running the business, not a robotic "marketing expert".
2. NO CLICHÉS: Never use phrases like "In today's digital world", "Take your business to the next level", "Unlock your potential", or "Elevate your game".
3. Avoid generic AI-style openings and repetitive marketing jargon.
4. Include a natural call-to-action only if it genuinely fits the context.
5. Use emojis sparingly and only when they truly enhance the message.
6. Keep it concise for social media (2-4 sentences max).
7. Ensure hashtags are hyper-specific to the image and niche, avoiding generic filler like #business or #marketing.

{instruction_line}

Respond ONLY in this exact format:
CAPTION: <caption text>
HASHTAGS: <hashtags separated by spaces, each starting with #>
"""

    last_error = None
    
    for model_name in MODEL_NAMES:
        try:
            print(f"[INFO - content_agent.py] Trying Gemini model: {model_name}")
            response = client.models.generate_content(
                model=model_name,
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type=media_type),
                    prompt,
                ],
            )
            
            text_output = response.text
            if not text_output:
                raise ValueError("The model returned an empty response.")
            return _parse_response(text_output.strip())
                
        except HTTPException:
            raise
        except Exception as e:
            error_msg = str(e)
            print(f"[WARNING - content_agent.py] Model {model_name} failed: {error_msg}")
            last_error = error_msg
            
            # Invalid or unauthorized API Key -> Fail immediately
            if any(err in error_msg.lower() for err in ["401", "403", "unauthorized", "api_key", "invalid api key"]):
                raise HTTPException(
                    status_code=401,
                    detail=f"Gemini API Key authentication failed for model {model_name}: {error_msg}"
                )
            
            # Quota Exceeded (429), Model Unavailable (503/404) -> Move to next model without repeating tries
            continue
            
    # If all models in the fallback chain fail
    status_code = 429 if (last_error and "429" in last_error) else 503
    raise HTTPException(
        status_code=status_code,
        detail=f"Gemini API Quota/Availability Limit reached across configured models. Last error ({MODEL_NAMES[-1]}): {last_error}"
    )


def generate_caption_from_topic(topic: str = None) -> dict:
    """
    Text-only caption generator fallback.
    """
    client = _get_genai_client()

    business_name = os.getenv("BUSINESS_NAME", "our business")
    niche = os.getenv("BUSINESS_NICHE", "general products")
    tone = os.getenv("BRAND_TONE", "friendly and professional")

    topic_instruction = f"Focus on: {topic}." if topic else "Come up with a relevant topic yourself."

    prompt = f"""You are writing an Instagram/Facebook post for "{business_name}", a business in the "{niche}" niche.
Target audience: Your followers and potential customers.
Brand tone: {tone}.

Task: Write a natural, human-sounding caption about the following topic.
{topic_instruction}

CRITICAL GUIDELINES:
1. Be authentic and engaging. Write like a real human running the business, not a robotic "marketing expert".
2. NO CLICHÉS: Never use phrases like "In today's digital world", "Take your business to the next level", "Unlock your potential", or "Elevate your game".
3. Avoid generic AI-style openings and repetitive marketing jargon.
4. Include a natural call-to-action only if it genuinely fits the context.
5. Use emojis sparingly and only when they truly enhance the message.
6. Keep it concise for social media (2-4 sentences max).
7. Ensure hashtags are hyper-specific to the topic and niche, avoiding generic filler like #business or #marketing.

Respond ONLY in this exact format:
CAPTION: <caption text>
HASHTAGS: <hashtags separated by spaces, each starting with #>
"""
    last_error = None
    
    for model_name in MODEL_NAMES:
        try:
            print(f"[INFO - content_agent.py] Trying Gemini model for topic: {model_name}")
            response = client.models.generate_content(
                model=model_name,
                contents=[prompt],
            )
            
            text_output = response.text
            if not text_output:
                raise ValueError("The model returned an empty response.")
            return _parse_response(text_output.strip())

        except HTTPException:
            raise
        except Exception as e:
            error_msg = str(e)
            print(f"[WARNING - content_agent.py] Model {model_name} failed: {error_msg}")
            last_error = error_msg
            
            if any(err in error_msg.lower() for err in ["401", "403", "unauthorized", "api_key"]):
                raise HTTPException(
                    status_code=401,
                    detail=f"Gemini API Key authentication failed for model {model_name}: {error_msg}"
                )
                
            continue
            
    status_code = 429 if (last_error and "429" in last_error) else 503
    raise HTTPException(
        status_code=status_code,
        detail=f"Gemini API Quota/Availability Limit reached across configured models. Last error ({MODEL_NAMES[-1]}): {last_error}"
    )


