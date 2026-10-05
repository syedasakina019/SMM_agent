"""
COMMUNITY AGENT (Phase 2 - Inbox/Replies)
=======================================
Analyzes inbound comments and DMs to determine sentiment,
flag sensitive content for human review, and generate contextual drafted replies.
"""

import os
import json
import re
import requests
from google import genai
from google.genai import types
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

MODEL_NAMES = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-pro-preview",
]


def analyze_inbound_message(text: str, media_url: str = None, context: list = None) -> dict:
    """
    Analyzes an inbound customer message, optionally with an image and previous conversation context.
    Returns a dict with:
      - sentiment (str): "positive", "neutral", or "negative"
      - is_flagged (bool): True if angry, inappropriate, or requires human escalation
      - suggested_reply (str): A drafted response
    """
    
    # Format context if available
    context_str = ""
    if context and len(context) > 0:
        context_str = "\nRecent Conversation History:\n"
        for msg in context:
            role = "Brand" if msg["sender"] == "brand" else "Customer"
            context_str += f"- {role}: {msg['text']}\n"
    
    prompt_text = f"""
    You are an expert AI customer support agent for a brand on social media.
    Analyze the following customer message and provide a JSON response exactly matching this schema:
    
    {{
      "sentiment": "positive|neutral|negative",
      "is_flagged": boolean,
      "suggested_reply": "string"
    }}
    
    Rules for is_flagged:
    - True IF the message is highly angry, uses profanity, contains spam, or asks complex support questions that an AI shouldn't confidently answer (e.g., account deletion, legal threats).
    - False otherwise.
    
    Rules for suggested_reply:
    - Keep it short, natural, and helpful.
    - Write it from the perspective of the brand responding to the customer.
    - Do NOT include generic AI filler.
    - If an image is provided, refer to it naturally if relevant.
    
    {context_str}
    
    Current Customer Message:
    "{text}"
    
    Return ONLY valid JSON.
    """

    # Handle optional media download
    contents = [prompt_text]
    if media_url:
        try:
            print(f"[DEBUG - community_agent.py] Downloading media from {media_url}")
            resp = requests.get(media_url, timeout=10)
            if resp.status_code == 200:
                content_type = resp.headers.get('Content-Type', 'image/jpeg')
                image_part = types.Part.from_bytes(data=resp.content, mime_type=content_type)
                contents.append(image_part)
            else:
                print(f"[DEBUG - community_agent.py] Failed to download media, status {resp.status_code}")
        except Exception as e:
            print(f"[DEBUG - community_agent.py] Failed to download media: {e}")

    for model_name in MODEL_NAMES:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    temperature=0.4,
                )
            )
            
            raw_text = response.text.strip()
            
            # Strip markdown JSON fences if Gemini adds them
            raw_text = re.sub(r"^```json\n", "", raw_text)
            raw_text = re.sub(r"^```\n", "", raw_text)
            raw_text = re.sub(r"\n```$", "", raw_text)
            raw_text = raw_text.strip()
            
            data = json.loads(raw_text)
            
            # Normalize and validate
            return {
                "sentiment": str(data.get("sentiment", "neutral")).lower(),
                "is_flagged": bool(data.get("is_flagged", False)),
                "suggested_reply": str(data.get("suggested_reply", ""))
            }
            
        except Exception as e:
            print(f"[DEBUG - community_agent.py] Model {model_name} failed: {e}")
            continue
            
    raise HTTPException(status_code=503, detail="All configured Gemini models failed to analyze the message.")
