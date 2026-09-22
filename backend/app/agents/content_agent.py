"""
CONTENT AGENT (Phase 1 - Image-Aware)
=======================================
Google Gemini API use karta hai (free tier). Ye image ko "dekh" kar
caption + hashtags likhta hai (Vision capability), aur ek text-only
fallback bhi deta hai.
"""

import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL_NAME = "gemini-3.6-flash"


def _parse_response(text_output: str) -> dict:
    caption = ""
    hashtags = ""
    for line in text_output.split("\n"):
        if line.startswith("CAPTION:"):
            caption = line.replace("CAPTION:", "").strip()
        elif line.startswith("HASHTAGS:"):
            hashtags = line.replace("HASHTAGS:", "").strip()
    return {"caption": caption, "hashtags": hashtags}


def generate_caption_from_image(image_bytes: bytes, media_type: str, extra_instructions: str = None) -> dict:
    """
    Image ko Gemini ko bhejta hai, jo image dekh kar caption/hashtags likhta hai.

    Args:
        image_bytes: uploaded image ki raw bytes
        media_type: "image/jpeg" ya "image/png"
        extra_instructions: optional extra instruction (jaisay "Eid sale mention karo")
    """
    business_name = os.getenv("BUSINESS_NAME", "our business")
    niche = os.getenv("BUSINESS_NICHE", "general products")
    tone = os.getenv("BRAND_TONE", "friendly and professional")

    instruction_line = (
        f"Additional instruction from the business owner: {extra_instructions}"
        if extra_instructions else ""
    )

    prompt = f"""You are a social media marketing expert writing an Instagram/Facebook 
post for "{business_name}", a business in the "{niche}" niche. Brand tone: {tone}.

Look at the attached image carefully. Write a caption that specifically describes 
or relates to what's actually in the image (colors, mood, product, setting) — 
do not write a generic caption that could apply to any photo.

{instruction_line}

Write:
1. An engaging caption (2-4 sentences) referencing the image content, ending with a call-to-action
2. 8-10 relevant hashtags

Respond ONLY in this exact format:
CAPTION: <caption text>
HASHTAGS: <hashtags separated by spaces, each starting with #>
"""

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=media_type),
            prompt,
        ],
    )

    return _parse_response(response.text.strip())


def generate_caption_from_topic(topic: str = None) -> dict:
    """
    Purana tareeka (bina image ke) — agar kabhi sirf text se
    caption chahiye ho.
    """
    business_name = os.getenv("BUSINESS_NAME", "our business")
    niche = os.getenv("BUSINESS_NICHE", "general products")
    tone = os.getenv("BRAND_TONE", "friendly and professional")

    topic_instruction = f"Focus on: {topic}." if topic else "Come up with a relevant topic yourself."

    prompt = f"""Write an Instagram caption for "{business_name}" ({niche} niche, {tone} tone).
{topic_instruction}
Respond ONLY as:
CAPTION: <caption>
HASHTAGS: <hashtags>
"""
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=[prompt],
    )
    return _parse_response(response.text.strip())
