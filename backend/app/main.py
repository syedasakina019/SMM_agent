"""
MAIN APPLICATION (Backend Entry Point)
=======================================
Frontend (navy/purple dashboard) yahan se ye endpoints call karega:
- /api/analyze-image   -> image upload karke caption/hashtags generate
- /api/posts (POST)    -> post ko save karna (Save Post button)
- /api/posts (GET)     -> saari posts ki list
- /api/best-time       -> AI ka suggested posting time
"""

from fastapi import FastAPI
from pydantic import BaseModel
import os
import shutil
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, Request, Response, BackgroundTasks, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from datetime import datetime, timezone
from dotenv import load_dotenv

from app.database.db import init_db, SessionLocal
from app.database.models import (
    Post, Conversation, Message, CommunitySettings, Ad, AdActivityLog,
    AdOptimizationAnalysis, AdRecommendation, AdVariation, AdAlert
)
from sqlalchemy.exc import IntegrityError
from app.agents.content_agent import generate_caption_from_image
from app.agents.scheduler import get_best_posting_time, start_scheduler
from app.agents.community_agent import analyze_inbound_message
from app.agents.ads_agent import generate_ad_campaign, generate_ad_creative
from app.agents.meta_ads_publisher import publish_ad_to_meta, publish_variation_to_meta
from app.agents.meta_ads_insights import fetch_meta_insights
from app.agents.meta_ads_manager import (
    update_meta_object_status, get_meta_object_status, sync_ad_meta_status, 
    log_activity, auto_sync_all_ads, retry_publish_ad, classify_meta_error
)
from app.agents.ad_optimization_agent import analyze_ad_performance, generate_ad_variations

from contextlib import asynccontextmanager

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the background APScheduler when the backend boots
    scheduler = start_scheduler()
    yield
    # Shut down the scheduler cleanly when the backend stops
    scheduler.shutdown()

app = FastAPI(title="AI Social Media Agent - Backend API", lifespan=lifespan)

# Build CORS origins list — always include both localhost variants
_cors_origins = [
    os.getenv("FRONTEND_URL", "http://localhost:3000"),
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/api/dashboard-summary")
def dashboard_summary():
    db = SessionLocal()
    try:
        total_posts = db.query(Post).count()
        draft_count = db.query(Post).filter(Post.status == "draft").count()
        scheduled_count = db.query(Post).filter(Post.status == "scheduled").count()
        published_count = db.query(Post).filter(Post.status == "published").count()

        return {
            "total_posts": total_posts,
            "draft_count": draft_count,
            "scheduled_count": scheduled_count,
            "published_count": published_count,
            "accounts_connected": {
                "instagram": False,
                "facebook": False,
            },
            "ai_agent_status": "online",
        }
    finally:
        db.close()


@app.get("/")
def home():
    return {"message": "AI Social Media Agent backend is running!"}


@app.get("/privacy-policy", response_class=HTMLResponse)
def get_privacy_policy():
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy - SocialMind AI</title>
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: #1e293b;
            --accent-purple: #8b5cf6;
            --accent-blue: #3b82f6;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --border-color: #334155;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            line-height: 1.6;
            padding: 20px;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            padding: 20px 0;
        }
        .header {
            background-color: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 32px;
            margin-bottom: 24px;
        }
        .header h1 {
            color: var(--text-primary);
            font-size: 2rem;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .header p {
            color: var(--text-secondary);
            font-size: 0.95rem;
        }
        .last-updated {
            display: inline-block;
            margin-top: 12px;
            padding: 4px 12px;
            background-color: rgba(139, 92, 246, 0.15);
            color: var(--accent-purple);
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
        }
        .section {
            background-color: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 20px;
        }
        .section h2 {
            font-size: 1.25rem;
            color: var(--text-primary);
            margin-bottom: 12px;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 8px;
        }
        .section p {
            color: var(--text-secondary);
            font-size: 0.95rem;
            margin-bottom: 12px;
        }
        .section ul {
            margin-left: 20px;
            color: var(--text-secondary);
            font-size: 0.95rem;
        }
        .section li {
            margin-bottom: 8px;
        }
        .highlight-box {
            background-color: rgba(59, 130, 246, 0.1);
            border-left: 4px solid var(--accent-blue);
            padding: 16px;
            border-radius: 6px;
            margin: 16px 0;
            color: var(--text-primary);
            font-size: 0.95rem;
        }
        .footer {
            text-align: center;
            padding: 24px;
            color: var(--text-secondary);
            font-size: 0.85rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Privacy Policy</h1>
            <p>SocialMind AI - AI-Powered Social Media Management Platform</p>
            <div class="last-updated">Last Updated: September 29, 2026</div>
        </div>

        <div class="section">
            <h2>1. Introduction</h2>
            <p>Welcome to <strong>SocialMind AI</strong> ("we," "our," "us," or "the Application"). We are committed to respecting your privacy and protecting your data when you use our AI-powered social media management application.</p>
            <p>This Privacy Policy explains how we collect, use, store, process, and protect your information when you interact with our platform, website, services, and Meta/Instagram integrations.</p>
        </div>

        <div class="section">
            <h2>2. Information We Collect</h2>
            <p>We collect only the essential information required to provide our social media management and AI-assisted creation services:</p>
            <ul>
                <li><strong>Social Media & Account Identifiers:</strong> Connected Page IDs, Instagram Business Account IDs, and authorized access tokens required to communicate with social platforms.</li>
                <li><strong>User-Generated Content:</strong> Post text drafts, captions, scheduled publishing times, and image files uploaded by users for post creation and AI image analysis.</li>
                <li><strong>Interaction & Community Data:</strong> Incoming comments, direct messages (DMs), and metadata received via webhooks to enable community management features.</li>
                <li><strong>System & Logs:</strong> Technical log data generated during API requests, webhook deliveries, and background post scheduling execution.</li>
            </ul>
        </div>

        <div class="section">
            <h2>3. How We Use Information</h2>
            <p>Your data is used solely to operate, maintain, and improve the features you explicitly request within the application. Specifically, we use collected information to:</p>
            <ul>
                <li>Generate AI post captions and analyze image content using Google Gemini AI APIs.</li>
                <li>Schedule and execute automated post publishing to connected social media accounts.</li>
                <li>Process incoming community comments and direct messages to display in your unified inbox and generate suggested or automated responses.</li>
                <li>Maintain database records of created posts, publishing statuses, and operational logs.</li>
            </ul>
        </div>

        <div class="section">
            <h2>4. Social Media and Meta/Instagram Data</h2>
            <div class="highlight-box">
                <strong>Strict Limited Use Guarantee:</strong> Meta and Instagram account data (including Page IDs, Instagram Business IDs, Graph API tokens, comments, and messages) is accessed and used <em>strictly for features explicitly requested and authorized by the user</em>.
            </div>
            <ul>
                <li>We use Meta Graph APIs to publish authorized posts, fetch comments, and dispatch approved community replies.</li>
                <li>We receive real-time webhook updates from Meta solely to maintain your live inbox and process user-enabled auto-replies.</li>
                <li>We do <strong>NOT</strong> sell, rent, trade, or transfer Meta user data to any third-party advertisers, data brokers, or external marketers.</li>
                <li>Meta access tokens are stored securely in backend server environment configurations and are never exposed publicly or sent to frontend clients.</li>
            </ul>
        </div>

        <div class="section">
            <h2>5. User-Uploaded Content</h2>
            <p>Images and media assets uploaded to the application are stored locally on secured application storage servers to facilitate post scheduling, Meta Graph API publishing, and optional AI vision analysis.</p>
            <p>Uploaded images are referenced by public or temporary asset URLs strictly necessary for Meta servers to download media during publication.</p>
        </div>

        <div class="section">
            <h2>6. Data Storage and Security</h2>
            <p>We implement industry-standard security measures to safeguard your information against unauthorized access, loss, or disclosure:</p>
            <ul>
                <li>Backend database and environment files containing credentials are hosted on restricted server infrastructure.</li>
                <li>API communication between frontend, backend, and external endpoints (Meta, Gemini) occurs over encrypted HTTPS connections.</li>
                <li>Sensitive credentials, such as API secret keys and long-lived access tokens, are isolated on the server side and never written to client-side storage.</li>
            </ul>
        </div>

        <div class="section">
            <h2>7. Data Retention and Deletion</h2>
            <p>We retain post records, conversation logs, and community settings only for as long as necessary to provide application services or fulfill functional requirements.</p>
            <p>Users may request complete deletion of their stored posts, database records, media uploads, or token configurations at any time. Upon receiving a valid request or account disconnect, associated data is permanently purged from our application storage.</p>
        </div>

        <div class="section">
            <h2>8. Third-Party Services</h2>
            <p>To deliver full AI and social media capabilities, our application integrates with select third-party service providers:</p>
            <ul>
                <li><strong>Meta Graph API (Facebook & Instagram):</strong> For social publishing, fetching messages/comments, and webhook event delivery.</li>
                <li><strong>Google Gemini AI API:</strong> For intelligent text content generation, post caption drafting, and optional image analysis.</li>
            </ul>
            <p style="margin-top: 10px;">These third-party providers process data in accordance with their respective privacy policies and security standards.</p>
        </div>

        <div class="section">
            <h2>9. Cookies and Similar Technologies</h2>
            <p>The application uses browser local storage and essential session tokens solely for maintaining user interface preferences, local active states, and navigation context. We do not use persistent cross-site tracking cookies or third-party advertising tracking scripts.</p>
        </div>

        <div class="section">
            <h2>10. User Rights</h2>
            <p>Depending on your jurisdiction, you have fundamental rights regarding your data:</p>
            <ul>
                <li><strong>Right to Access:</strong> View all stored posts, scheduled items, and community settings inside the application dashboard.</li>
                <li><strong>Right to Rectification:</strong> Edit or update any scheduled content, draft captions, or auto-reply settings.</li>
                <li><strong>Right to Erasure:</strong> Request immediate removal of your account configuration and database records.</li>
                <li><strong>Right to Revoke Permissions:</strong> Disconnect your Meta/Instagram accounts or invalidate API access tokens at any time.</li>
            </ul>
        </div>

        <div class="section">
            <h2>11. Children's Privacy</h2>
            <p>Our application is intended for professional and business social media management. We do not knowingly collect or solicit personal information from individuals under the age of 13. If you believe a minor has provided data to us, please contact us immediately so we can remove the information.</p>
        </div>

        <div class="section">
            <h2>12. Changes to This Privacy Policy</h2>
            <p>We may update this Privacy Policy periodically to reflect enhancements to our application features, legal requirements, or API guidelines. Any modifications will be published directly on this page with an updated "Last Updated" date at the top of the document.</p>
        </div>

        <div class="section">
            <h2>13. Contact Information</h2>
            <p>If you have any questions, concerns, or requests regarding this Privacy Policy or your data, you can reach out via the application settings page or contact our system administrator:</p>
            <div style="background-color: var(--bg-color); padding: 12px; border-radius: 8px; margin-top: 10px;">
                <p><strong>SocialMind AI Support & Privacy Team</strong></p>
                <p style="font-size: 0.85rem; color: var(--text-secondary);">Application Route: /settings</p>
            </div>
        </div>

        <div class="footer">
            &copy; 2026 SocialMind AI. All rights reserved.
        </div>
    </div>
</body>
</html>"""
    return HTMLResponse(content=html_content)



@app.post("/api/analyze-image")
async def analyze_image(
    image: UploadFile = File(...),
    instructions: str = Form(None),
):
    image_bytes = await image.read()
    media_type = image.content_type or "image/jpeg"

    result = generate_caption_from_image(image_bytes, media_type, instructions)

    print(f"\n[DEBUG - main.py] Result received from content_agent: {type(result)}")
    print(f"[DEBUG - main.py] Contains 'caption': {'caption' in result}")
    print(f"[DEBUG - main.py] Contains 'hashtags': {'hashtags' in result}")

    filename = f"{datetime.utcnow().timestamp()}_{image.filename}"
    file_path = UPLOAD_DIR / filename
    with open(file_path, "wb") as f:
        f.write(image_bytes)

    response_dict = {
        "caption": result["caption"],
        "hashtags": result["hashtags"],
        "image_path": f"/uploads/{filename}",
    }
    
    print(f"[DEBUG - main.py] Sending response: caption type: {type(response_dict['caption'])}, hashtags type: {type(response_dict['hashtags'])}\n")

    return response_dict


@app.post("/api/upload")
async def upload_image(image: UploadFile = File(...)):
    image_bytes = await image.read()
    filename = f"{datetime.utcnow().timestamp()}_{image.filename}"
    file_path = UPLOAD_DIR / filename
    with open(file_path, "wb") as f:
        f.write(image_bytes)
    return {"success": True, "image_path": f"/uploads/{filename}"}


import zoneinfo
from fastapi import HTTPException

@app.get("/api/best-time")
def best_time(timezone: str = None):
    if not timezone:
        raise HTTPException(status_code=400, detail="Timezone query parameter is required.")
    
    try:
        zoneinfo.ZoneInfo(timezone)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid timezone: {timezone}")
        
    return get_best_posting_time(timezone)


@app.post("/api/posts")
def save_post(
    caption: str = Form(...),
    hashtags: str = Form(""),
    image_path: str = Form(None),
    platforms: str = Form("instagram"),
    schedule_mode: str = Form("ai"),
    scheduled_time: str = Form(None),
):
    db = SessionLocal()
    try:
        parsed_dt = None
        if scheduled_time:
            s = scheduled_time.strip()
            if s.endswith("Z") or s.endswith("z"):
                s = s[:-1] + "+00:00"
            dt = datetime.fromisoformat(s)
            if dt.tzinfo is None:
                # If timezone is omitted, treat as local time (Asia/Karachi) and convert to UTC
                local_tz = zoneinfo.ZoneInfo("Asia/Karachi")
                dt = dt.replace(tzinfo=local_tz).astimezone(timezone.utc).replace(tzinfo=None)
            else:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
            parsed_dt = dt

        status_val = "scheduled" if (schedule_mode != "immediate" and parsed_dt is not None) else "draft"

        new_post = Post(
            caption=caption,
            hashtags=hashtags,
            image_path=image_path,
            platforms=platforms,
            schedule_mode=schedule_mode,
            scheduled_time=parsed_dt,
            status=status_val,
        )
        db.add(new_post)
        db.commit()
        db.refresh(new_post)
        return {"success": True, "post_id": new_post.id, "post": {
            "id": new_post.id,
            "caption": new_post.caption,
            "hashtags": new_post.hashtags,
            "image_path": new_post.image_path,
            "platforms": new_post.platforms,
            "status": new_post.status,
            "schedule_mode": new_post.schedule_mode,
            "scheduled_time": _format_utc_iso(new_post.scheduled_time),
            "created_at": _format_utc_iso(new_post.created_at),
            "published_at": _format_utc_iso(new_post.published_at),
            "cancelled_at": _format_utc_iso(new_post.cancelled_at),
            "external_post_id": new_post.external_post_id,
            "error_message": new_post.error_message,
        }}
    finally:
        db.close()



from app.agents.meta_publisher import publish_to_meta, reply_to_meta_comment, send_meta_direct_message, fetch_instagram_user_info

def _format_utc_iso(dt):
    if not dt:
        return None
    return dt.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")

@app.get("/api/posts")
def get_all_posts():
    db = SessionLocal()
    try:
        posts = db.query(Post).order_by(Post.created_at.desc()).all()
        return [
            {
                "id": p.id,
                "caption": p.caption,
                "hashtags": p.hashtags,
                "image_path": p.image_path,
                "platforms": p.platforms,
                "status": p.status,
                "schedule_mode": p.schedule_mode,
                "scheduled_time": _format_utc_iso(p.scheduled_time),
                "created_at": _format_utc_iso(p.created_at),
                "published_at": _format_utc_iso(p.published_at),
                "cancelled_at": _format_utc_iso(p.cancelled_at),
                "external_post_id": p.external_post_id,
                "error_message": p.error_message,
            }
            for p in posts
        ]
    finally:
        db.close()


@app.delete("/api/posts/{post_id}")
def delete_post(post_id: int):
    db = SessionLocal()
    try:
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        db.delete(post)
        db.commit()
        return {"success": True, "message": "Post deleted successfully"}
    finally:
        db.close()


@app.post("/api/posts/{post_id}/cancel")
def cancel_post(post_id: int):
    db = SessionLocal()
    try:
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        post.status = "cancelled"
        post.cancelled_at = datetime.utcnow()
        db.commit()
        return {"success": True, "message": "Post cancelled successfully"}
    finally:
        db.close()


@app.post("/api/posts/{post_id}/publish-now")
def publish_post_now(post_id: int):
    db = SessionLocal()
    try:
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        post.status = "publishing"
        db.commit()
        
        try:
            result = publish_to_meta(post)
        except Exception as exc:
            result = {"success": False, "error": f"Publish error: {exc}"}
            
        if result.get("success"):
            post.status = "published"
            post.published_at = datetime.utcnow()
            post.external_post_id = result.get("external_id")
            post.error_message = None
        else:
            post.status = "failed"
            post.error_message = result.get("error", "Unknown publishing failure")
            
        db.commit()
        return {"success": result.get("success", False), "status": post.status, "error_message": post.error_message}
    finally:
        db.close()


# ─── META WEBHOOK RECEIVER ───────────────────────────────────────────────────

META_VERIFY_TOKEN = os.getenv("META_VERIFY_TOKEN", "my_secret_verify_token_123")

@app.get("/api/webhook/meta")
def verify_webhook(request: Request):
    """
    Meta Developer Portal calls this to verify the webhook URL.
    """
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    current_verify_token = os.getenv("META_VERIFY_TOKEN", "my_secret_verify_token_123").strip()

    if mode and token:
        if mode == "subscribe" and token == current_verify_token:
            print("[INFO - webhook] Webhook verified successfully!")
            return Response(content=challenge or "", media_type="text/plain")
        else:
            raise HTTPException(status_code=403, detail="Verification token mismatch")
    
    raise HTTPException(status_code=400, detail="Missing hub parameters")



def process_incoming_meta_message(payload: dict):
    """Background task to process the payload and use Gemini AI."""
    import json as _json
    PAGE_ID = os.getenv("META_PAGE_ID") or "my_page_id"
    IG_ID = os.getenv("INSTAGRAM_BUSINESS_ACCOUNT_ID") or ""

    obj_type = payload.get("object")
    entries = payload.get("entry", [])
    print(f"\n==================== [WEBHOOK PROCESSING] ====================")
    print(f"object: {obj_type!r}")
    print(f"entry_count: {len(entries)}")

    try:
        for idx, entry in enumerate(entries):
            entry_id = entry.get("id")
            print(f"--- Entry [{idx}] id={entry_id} ---")

            # ── INSTAGRAM / MESSENGER DIRECT MESSAGES ──────────────────────
            if "messaging" in entry:
                messaging_list = entry.get("messaging", [])
                print(f"messaging_count: {len(messaging_list)}")
                for event in messaging_list:
                    sender_id = event.get("sender", {}).get("id")

                    # Loop Prevention: Don't process messages sent BY the page or IG account
                    if sender_id and (sender_id == PAGE_ID or sender_id == IG_ID):
                        print(f"[DEBUG - webhook] Skipping own-page/own-account DM sender {sender_id}")
                        continue

                    if "message" in event:
                        message_id = event["message"].get("mid")
                        text = event["message"].get("text", "")

                        media_url = None
                        attachments = event["message"].get("attachments", [])
                        for att in attachments:
                            if att.get("type") in ["image", "video"]:
                                media_url = att.get("payload", {}).get("url")
                                break

                        if text or media_url:
                            # Resolve real Instagram username from IGSID
                            print(f"[INFO - webhook] DM from IGSID={sender_id}, looking up profile...")
                            user_info = fetch_instagram_user_info(sender_id)
                            sender_name = (
                                user_info.get("username")
                                or user_info.get("name")
                                or f"IG:{sender_id}"
                            )
                            print(f"[INFO - webhook] DM sender resolved: {sender_name!r}")
                            handle_incoming_message(sender_id, sender_name, "dm", "instagram", text, message_id, media_url)

            # ── CHANGES (COMMENTS + FEED EVENTS) ──────────────────────────
            # NOTE: Use separate `if`, not `elif`, so entries with BOTH
            # messaging and changes are fully handled.
            if "changes" in entry:
                changes = entry.get("changes", [])
                print(f"changes_count: {len(changes)}")
                for change in changes:
                    field = change.get("field", "")
                    value = change.get("value", {})
                    value_keys = list(value.keys()) if isinstance(value, dict) else []

                    from_obj = value.get("from") if isinstance(value, dict) else {}
                    sender_id = from_obj.get("id") if isinstance(from_obj, dict) else (value.get("sender_id") or "unknown")
                    comment_id = value.get("id") or value.get("comment_id") if isinstance(value, dict) else None
                    comment_text = (value.get("text") or value.get("message")) if isinstance(value, dict) else None

                    print(f"  FIELD: {field!r}")
                    print(f"  RELEVANT VALUE KEYS: {value_keys}")
                    print(f"  COMMENT ID: {comment_id}")
                    print(f"  COMMENT TEXT: {comment_text!r}")
                    print(f"  SENDER/FROM ID: {sender_id}")

                    # ── Format 1: Instagram `comments` field subscription ──
                    if field == "comments":
                        if sender_id and (sender_id == PAGE_ID or sender_id == IG_ID):
                            print(f"[DEBUG - webhook] Skipping own-page/account comment (IG comments field)")
                            continue
                        sender_name = ""
                        if isinstance(from_obj, dict):
                            sender_name = from_obj.get("username") or from_obj.get("name") or ""
                        if not sender_name:
                            sender_name = f"IG:{sender_id}"

                        text = comment_text or ""
                        message_id = comment_id
                        media_url = value.get("media", {}).get("url") if isinstance(value.get("media"), dict) else None

                        if text or media_url:
                            print(f"[INFO - webhook] Instagram comment (comments field): from={sender_name!r} id={message_id}")
                            handle_incoming_message(sender_id, sender_name, "comment", "instagram", text, message_id, media_url)

                    # ── Format 2: Facebook Page `feed` field subscription ──
                    elif field == "feed" and isinstance(value, dict) and value.get("item") == "comment" and value.get("verb") == "add":
                        if sender_id and (sender_id == PAGE_ID or sender_id == IG_ID):
                            print(f"[DEBUG - webhook] Skipping own-page comment (FB feed field)")
                            continue
                        sender_name = from_obj.get("name") if isinstance(from_obj, dict) else f"FB:{sender_id}"
                        text = comment_text or ""
                        message_id = comment_id
                        media_url = value.get("photo") or value.get("video") or None
                        if text or media_url:
                            print(f"[INFO - webhook] Facebook comment (feed field): from={sender_name!r} id={message_id}")
                            handle_incoming_message(sender_id, sender_name, "comment", "facebook", text, message_id, media_url)

                    # ── Legacy format fallback ──
                    elif not field and isinstance(value, dict) and value.get("item") == "comment" and value.get("verb") == "add":
                        if sender_id and (sender_id == PAGE_ID or sender_id == IG_ID):
                            continue
                        sender_name = from_obj.get("name") if isinstance(from_obj, dict) else f"User:{sender_id}"
                        text = comment_text or ""
                        message_id = comment_id
                        media_url = value.get("photo") or value.get("video") or None
                        if text or media_url:
                            print(f"[INFO - webhook] Comment (legacy no-field): from={sender_name!r} id={message_id}")
                            handle_incoming_message(sender_id, sender_name, "comment", "facebook", text, message_id, media_url)

                    else:
                        print(f"[DEBUG - webhook] Unhandled change field={field!r} keys={value_keys}")

    except Exception as e:
        import traceback
        print(f"[ERROR - webhook] Error in process_incoming_meta_message: {e}")
        traceback.print_exc()

    print(f"==============================================================\n")



def handle_incoming_message(sender_id: str, sender_name: str, msg_type: str, platform: str, text: str, message_id: str, media_url: str = None):
    db = SessionLocal()
    try:
        if not message_id:
            message_id = f"msg_{datetime.utcnow().timestamp()}"

        print(f"[INFO - webhook] Processing {msg_type} from sender_id={sender_id} name={sender_name!r} msg_id={message_id!r}")

        # Duplicate protection
        existing_msg = db.query(Message).filter(Message.external_message_id == message_id).first()
        if existing_msg:
            print(f"[DEBUG - webhook] Duplicate event ignored for message {message_id}")
            return

        # Check if conversation exists
        convo = db.query(Conversation).filter(
            Conversation.external_user_id == sender_id,
            Conversation.type == msg_type
        ).first()

        if not convo:
            convo = Conversation(
                platform=platform,
                type=msg_type,
                external_user_id=sender_id,
                external_username=sender_name
            )
            db.add(convo)
            db.commit()
            db.refresh(convo)
            print(f"[INFO - webhook] Created new conversation id={convo.id} type={msg_type}")
        else:
            print(f"[INFO - webhook] Found existing conversation id={convo.id}")

        # Context Memory
        recent_messages = db.query(Message).filter(Message.conversation_id == convo.id).order_by(Message.timestamp.desc()).limit(5).all()
        recent_messages.reverse()
        context = [{"sender": m.sender, "text": m.text} for m in recent_messages if m.text]

        # --- AI ANALYSIS (non-blocking: always save message even if AI fails) ---
        ai_data = {"sentiment": "neutral", "is_flagged": False, "suggested_reply": ""}
        try:
            print(f"[DEBUG - webhook] Calling Gemini AI for {msg_type} analysis...")
            ai_data = analyze_inbound_message(text, media_url, context)
            print(f"[INFO - webhook] AI result: sentiment={ai_data['sentiment']} flagged={ai_data['is_flagged']}")
        except Exception as ai_err:
            print(f"[WARNING - webhook] Gemini AI failed, using defaults. Error: {ai_err}")

        # Update conversation status
        convo.sentiment = ai_data["sentiment"]
        convo.is_flagged = ai_data["is_flagged"]
        convo.is_unread = True
        convo.updated_at = datetime.utcnow()

        # Save the incoming user message
        new_msg = Message(
            conversation_id=convo.id,
            external_message_id=message_id,
            sender="user",
            text=text or "",
            media_url=media_url,
            ai_suggested_reply=ai_data.get("suggested_reply") or None
        )
        db.add(new_msg)
        try:
            db.commit()
            print(f"[INFO - webhook] Saved {msg_type} message to DB (convo_id={convo.id})")
        except IntegrityError:
            db.rollback()
            print(f"[DEBUG - webhook] IntegrityError: Duplicate message {message_id} skipped.")
            return

        # --- AUTO REPLY LOGIC ---
        settings = db.query(CommunitySettings).first()
        if not settings:
            settings = CommunitySettings()
            db.add(settings)
            db.commit()

        auto_reply_enabled = settings.comments_auto_reply if msg_type == "comment" else settings.dm_auto_reply
        suggested = ai_data.get("suggested_reply", "")

        # Only auto-reply if: enabled, not flagged, not negative sentiment, and AI gave a reply
        if auto_reply_enabled and not convo.is_flagged and convo.sentiment != "negative" and suggested:
            print(f"[INFO - community] Auto-reply triggered for {msg_type} from {sender_name}")
            reply_text = suggested
            
            # Save Brand Reply Message immediately as pending
            brand_msg = Message(
                conversation_id=convo.id,
                external_message_id=f"auto_{datetime.utcnow().timestamp()}",
                sender="brand",
                text=reply_text,
                is_auto_replied=True,
                reply_status="pending"
            )
            db.add(brand_msg)
            db.commit()

            print(f"[INFO - community] Dispatching Meta API auto-reply for {msg_type}...")
            if msg_type == "comment":
                meta_res = reply_to_meta_comment(message_id, reply_text)
            else:
                meta_res = send_meta_direct_message(sender_id, reply_text)

            if meta_res.get("success"):
                brand_msg.reply_status = "success"
                if meta_res.get("external_id"):
                    brand_msg.external_message_id = meta_res["external_id"]
                brand_msg.error_message = None
                print(f"[INFO - community] Meta API auto-reply SUCCESS (ID: {brand_msg.external_message_id})")
            else:
                brand_msg.reply_status = "failed"
                brand_msg.error_message = meta_res.get("error", "Unknown Meta API error")
                # NOTE: Do NOT flag the conversation just because Meta delivery failed.
                # The message is already in DB and visible in Comments/DMs tab.
                print(f"[WARNING - community] Meta API auto-reply FAILED (will retry manually): {brand_msg.error_message}")
                
            db.commit()
        else:
            print(f"[INFO - webhook] Auto-reply skipped: enabled={auto_reply_enabled} flagged={convo.is_flagged} sentiment={convo.sentiment} has_reply={bool(suggested)}")

    except Exception as e:
        import traceback
        print(f"[ERROR - webhook] Unexpected error in handle_incoming_message: {e}")
        traceback.print_exc()
    finally:
        db.close()



@app.post("/api/webhook/meta")
async def receive_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Receives incoming webhook payloads from Meta (Instagram/Facebook).
    """
    import sys
    import json as _json
    import datetime as _dt

    try:
        payload = await request.json()
        
        # VERY START DIAGNOSTIC LOGGING
        print(f"\n==================== [META WEBHOOK RECEIVED {_dt.datetime.utcnow().isoformat()}] ====================", flush=True)
        print(f"OBJECT: {payload.get('object')}", flush=True)
        
        entries = payload.get("entry", [])
        print(f"ENTRY: {entries}", flush=True)
        
        for i, entry in enumerate(entries):
            print(f"--- Entry [{i}] id={entry.get('id')} time={entry.get('time')} ---", flush=True)
            changes = entry.get("changes", [])
            print(f"CHANGES: {changes}", flush=True)
            for c in changes:
                field = c.get("field")
                val = c.get("value", {})
                sender_info = val.get("from") or val.get("sender") or val.get("user")
                comment_id = val.get("id") or val.get("comment_id")
                comment_text = val.get("text") or val.get("message")
                
                print(f"FIELD: {field!r}", flush=True)
                print(f"VALUE: {_json.dumps(val, default=str)}", flush=True)
                print(f"SENDER/FROM INFORMATION: {sender_info}", flush=True)
                print(f"COMMENT ID: {comment_id}", flush=True)
                print(f"COMMENT TEXT: {comment_text}", flush=True)
                
            messaging = entry.get("messaging", [])
            if messaging:
                print(f"MESSAGING: {messaging}", flush=True)
        
        # Complete incoming request JSON (sanitized)
        print("COMPLETE INCOMING REQUEST JSON:", flush=True)
        print(_json.dumps(payload, indent=2, default=str), flush=True)
        print("=================================================================================\n", flush=True)
        sys.stdout.flush()

        # Write to dedicated diagnostic log file
        log_file_path = os.path.join(os.path.dirname(__file__), "..", "webhook_diagnostic.log")
        with open(log_file_path, "a", encoding="utf-8") as f:
            f.write(f"[{_dt.datetime.utcnow().isoformat()}] Payload: {_json.dumps(payload)}\n")

        # Meta requires a 200 OK immediately, so we process in background
        background_tasks.add_task(process_incoming_meta_message, payload)
        
        return "EVENT_RECEIVED"
    except Exception as e:
        print(f"[DEBUG - webhook] POST Error: {e}", flush=True)
        raise HTTPException(status_code=400, detail="Invalid payload")


# ─── COMMUNITY FRONTEND API ──────────────────────────────────────────────────

@app.get("/api/community/conversations")
def get_conversations(tab: str = "Comments"):
    """
    Returns a list of conversations for the left sidebar.
    Filters by the frontend active tab (Comments, Direct Messages, Flagged).
    """
    db = SessionLocal()
    try:
        query = db.query(Conversation)
        
        if tab == "Comments":
            query = query.filter(Conversation.type == "comment")
        elif tab == "Direct Messages":
            query = query.filter(Conversation.type == "dm")
        elif tab == "Flagged":
            query = query.filter(Conversation.is_flagged == True)
            
        convos = query.order_by(Conversation.updated_at.desc()).all()
        
        result = []
        for c in convos:
            last_msg = db.query(Message).filter(Message.conversation_id == c.id).order_by(Message.timestamp.desc()).first()
            
            # Determine conversation status based on actual DB records
            brand_msgs = db.query(Message).filter(Message.conversation_id == c.id, Message.sender == "brand").all()
            has_auto_reply = any(m.is_auto_replied for m in brand_msgs)
            has_manual_reply = any(not m.is_auto_replied for m in brand_msgs)
            
            if c.is_flagged:
                status_key = "NEEDS_REVIEW"
            elif has_auto_reply:
                status_key = "AI_AUTO_REPLIED"
            elif has_manual_reply:
                status_key = "MANUAL_REPLIED"
            else:
                status_key = "PENDING"
            
            # Format real timestamp relative string
            time_str = "Just now"
            ref_dt = last_msg.timestamp if last_msg and last_msg.timestamp else c.updated_at
            if ref_dt:
                diff_seconds = (datetime.utcnow() - ref_dt).total_seconds()
                if diff_seconds < 60:
                    time_str = "Just now"
                elif diff_seconds < 3600:
                    mins = int(diff_seconds // 60)
                    time_str = f"{mins}m ago"
                elif diff_seconds < 86400:
                    hrs = int(diff_seconds // 3600)
                    time_str = f"{hrs}h ago"
                else:
                    days = int(diff_seconds // 86400)
                    time_str = f"{days}d ago"

            # Build human-friendly display name and handle
            raw_username = c.external_username or ""
            raw_user_id = c.external_user_id or ""

            # If username is a bare numeric IGSID or empty, show a friendlier label
            if not raw_username or raw_username.isdigit():
                display_user = "Instagram User"
                display_handle = f"ID:{raw_user_id}"
            elif raw_username.startswith("IG:"):
                # Our own fallback format from the new webhook code
                ig_id = raw_username[3:]
                display_user = "Instagram User"
                display_handle = f"ID:{ig_id}"
            elif raw_username.startswith("FB:") or raw_username.startswith("User:"):
                display_user = raw_username
                display_handle = f"@{raw_user_id}"
            else:
                display_user = raw_username
                # Strip spaces/colons for the handle
                safe_handle = raw_username.lower().replace(" ", "").replace(":", "")
                display_handle = f"@{safe_handle}"

            result.append({
                "id": c.id,
                "user": display_user,
                "handle": display_handle,
                "external_user_id": raw_user_id,
                "platform": c.platform,
                "message": last_msg.text if last_msg else "",
                "time": time_str,
                "flagged": c.is_flagged,
                "sentiment": c.sentiment,
                "unread": c.is_unread,
                "suggestedReply": last_msg.ai_suggested_reply if last_msg else "",
                "status": status_key,
                "isAutoReplied": has_auto_reply,
                "hasBrandReply": len(brand_msgs) > 0
            })
            
        return result
    finally:
        db.close()


@app.get("/api/community/conversations/{convo_id}/messages")
def get_conversation_messages(convo_id: int):
    """
    Returns the chat history for a selected conversation.
    """
    db = SessionLocal()
    try:
        convo = db.query(Conversation).filter(Conversation.id == convo_id).first()
        if not convo:
            raise HTTPException(status_code=404, detail="Conversation not found")
            
        # Mark as read
        if convo.is_unread:
            convo.is_unread = False
            db.commit()
            
        messages = db.query(Message).filter(Message.conversation_id == convo_id).order_by(Message.timestamp.asc()).all()
        
        return [
            {
                "id": m.id,
                "sender": m.sender,
                "text": m.text,
                "media_url": m.media_url,
                "timestamp": m.timestamp.isoformat(),
                "ai_suggested_reply": m.ai_suggested_reply,
                "is_auto_replied": m.is_auto_replied,
                "reply_status": m.reply_status,
                "error_message": m.error_message
            } for m in messages
        ]
    finally:
        db.close()

@app.get("/api/community/settings")
def get_community_settings():
    db = SessionLocal()
    try:
        settings = db.query(CommunitySettings).first()
        if not settings:
            settings = CommunitySettings()
            db.add(settings)
            db.commit()
            db.refresh(settings)
        return {
            "comments_auto_reply": settings.comments_auto_reply,
            "dm_auto_reply": settings.dm_auto_reply
        }
    finally:
        db.close()

class SettingsUpdate(BaseModel):
    comments_auto_reply: bool
    dm_auto_reply: bool

@app.post("/api/community/settings")
def update_community_settings(payload: SettingsUpdate):
    db = SessionLocal()
    try:
        settings = db.query(CommunitySettings).first()
        if not settings:
            settings = CommunitySettings()
            db.add(settings)
        
        settings.comments_auto_reply = payload.comments_auto_reply
        settings.dm_auto_reply = payload.dm_auto_reply
        db.commit()
        return {"success": True}
    finally:
        db.close()


from pydantic import BaseModel

class ReplyRequest(BaseModel):
    text: str

@app.post("/api/community/conversations/{convo_id}/reply")
def send_reply(convo_id: int, payload: ReplyRequest):
    """
    Sends a reply to the customer via Meta Graph API and saves it to the DB.
    """
    db = SessionLocal()
    try:
        convo = db.query(Conversation).filter(Conversation.id == convo_id).first()
        if not convo:
            raise HTTPException(status_code=404, detail="Conversation not found")
            
        reply_text = (payload.text or "").strip()
        if not reply_text:
            raise HTTPException(status_code=400, detail="Reply text cannot be empty")

        # Find target ID: for comments, find last user comment's external_message_id; for DMs, use external_user_id
        last_user_msg = db.query(Message).filter(
            Message.conversation_id == convo.id,
            Message.sender == "user"
        ).order_by(Message.timestamp.desc()).first()

        target_id = last_user_msg.external_message_id if (convo.type == "comment" and last_user_msg) else convo.external_user_id

        # 1. Save reply to local DB as pending
        new_msg = Message(
            conversation_id=convo.id,
            external_message_id=f"brand_{datetime.utcnow().timestamp()}",
            sender="brand",
            text=reply_text,
            is_auto_replied=False,
            reply_status="pending"
        )
        db.add(new_msg)
        db.commit()
        
        print(f"[INFO - community] Attempting manual reply for {convo.type} (target ID: {target_id})...")

        # 2. Dispatch real Meta Graph API call
        if convo.type == "comment":
            meta_res = reply_to_meta_comment(target_id, reply_text)
        else:
            meta_res = send_meta_direct_message(target_id, reply_text)

        if meta_res.get("success"):
            new_msg.reply_status = "success"
            if meta_res.get("external_id"):
                new_msg.external_message_id = meta_res["external_id"]
            new_msg.error_message = None
            convo.is_flagged = False
            convo.updated_at = datetime.utcnow()
            db.commit()
            print(f"[INFO - community] Meta API manual reply SUCCESS (ID: {new_msg.external_message_id})")
            return {"success": True, "message": "Reply sent successfully via Meta API", "external_id": new_msg.external_message_id}
        else:
            new_msg.reply_status = "failed"
            new_msg.error_message = meta_res.get("error", "Meta API reply failed")
            db.commit()
            print(f"[ERROR - community] Meta API manual reply FAILURE: {new_msg.error_message}")
            raise HTTPException(status_code=502, detail=new_msg.error_message)

    finally:
        db.close()


# ─── ADS MANAGEMENT API ──────────────────────────────────────────────────────

class AdSchema(BaseModel):
    name: str
    objective: str = "Awareness"
    platform: str = "instagram,facebook"
    status: str = "draft"
    primary_text: str | None = None
    headline: str | None = None
    cta: str | None = "Learn More"
    media_path: str | None = None
    audience_location: str | None = "United States"
    audience_age_min: int | None = 18
    audience_age_max: int | None = 65
    audience_gender: str | None = "all"
    audience_interests: str | None = None
    daily_budget: float | None = 0.0
    total_budget: float | None = 0.0
    start_date: str | None = None
    end_date: str | None = None
    ai_optimized: bool = False


def _format_ad_dict(ad: Ad) -> dict:
    err_class = classify_meta_error(ad.meta_error_message or ad.error_message)
    return {
        "id": ad.id,
        "name": ad.name,
        "objective": ad.objective,
        "platform": ad.platform,
        "status": ad.status,
        "primary_text": ad.primary_text,
        "headline": ad.headline,
        "cta": ad.cta,
        "media_path": ad.media_path,
        "audience_location": ad.audience_location,
        "audience_age_min": ad.audience_age_min,
        "audience_age_max": ad.audience_age_max,
        "audience_gender": ad.audience_gender,
        "audience_interests": ad.audience_interests,
        "daily_budget": ad.daily_budget,
        "total_budget": ad.total_budget,
        "start_date": _format_utc_iso(ad.start_date),
        "end_date": _format_utc_iso(ad.end_date),
        "spend": ad.spend,
        "results": ad.results,
        "ai_optimized": ad.ai_optimized,
        "error_message": ad.error_message,
        "meta_ad_account_id": ad.meta_ad_account_id,
        "meta_campaign_id": ad.meta_campaign_id,
        "meta_adset_id": ad.meta_adset_id,
        "meta_creative_id": ad.meta_creative_id,
        "meta_ad_id": ad.meta_ad_id,
        "meta_campaign_status": getattr(ad, "meta_campaign_status", "PAUSED") or "PAUSED",
        "meta_adset_status": getattr(ad, "meta_adset_status", "PAUSED") or "PAUSED",
        "meta_ad_status": getattr(ad, "meta_ad_status", "PAUSED") or "PAUSED",
        "meta_publish_status": ad.meta_publish_status or "not_published",
        "meta_error_message": ad.meta_error_message,
        "meta_published_at": _format_utc_iso(ad.meta_published_at),
        "last_synced_at": _format_utc_iso(getattr(ad, "last_synced_at", None)),
        "error_classification": err_class,
        "created_at": _format_utc_iso(ad.created_at),
        "updated_at": _format_utc_iso(ad.updated_at),
    }


def _format_variation_dict(v: AdVariation) -> dict:
    err_class = classify_meta_error(getattr(v, "meta_error_message", None))
    return {
        "id": v.id,
        "ad_id": v.ad_id,
        "variation_name": v.variation_name,
        "primary_text": v.primary_text,
        "headline": v.headline,
        "cta": v.cta,
        "description": v.description,
        "creative_concept": v.creative_concept,
        "status": v.status,
        "impressions": v.impressions or 0,
        "clicks": v.clicks or 0,
        "ctr": float(v.ctr or 0.0),
        "cpc": float(v.cpc or 0.0),
        "spend": float(v.spend or 0.0),
        "results": v.results or 0,
        "meta_creative_id": getattr(v, "meta_creative_id", None),
        "meta_ad_id": getattr(v, "meta_ad_id", None),
        "meta_ad_status": getattr(v, "meta_ad_status", "PAUSED") or "PAUSED",
        "meta_publish_status": getattr(v, "meta_publish_status", "not_published") or "not_published",
        "meta_error_message": getattr(v, "meta_error_message", None),
        "error_classification": err_class,
        "meta_published_at": _format_utc_iso(v.meta_published_at) if getattr(v, "meta_published_at", None) else None,
        "last_synced_at": _format_utc_iso(v.last_synced_at) if getattr(v, "last_synced_at", None) else None,
        "created_at": _format_utc_iso(v.created_at) if getattr(v, "created_at", None) else None,
    }



@app.get("/api/ads")
def get_all_ads(tab: str = "All Ads"):
    """
    Returns list of ad campaigns and aggregated summary metrics.
    """
    db = SessionLocal()
    try:
        query = db.query(Ad)
        if tab == "Active":
            query = query.filter(Ad.status == "active")
        elif tab == "Scheduled":
            query = query.filter(Ad.status == "scheduled")
        elif tab == "Drafts":
            query = query.filter(Ad.status == "draft")
        elif tab == "Completed":
            query = query.filter(Ad.status == "completed")

        ads = query.order_by(Ad.created_at.desc()).all()

        # Compute summary metrics across all ads in database
        all_ads = db.query(Ad).all()
        total_campaigns = len(all_ads)
        active_campaigns = sum(1 for a in all_ads if a.status == "active")
        total_spend = sum(a.spend for a in all_ads)
        total_results = sum(a.results for a in all_ads)

        return {
            "summary": {
                "total_campaigns": total_campaigns,
                "active_campaigns": active_campaigns,
                "total_spend": total_spend,
                "total_results": total_results,
            },
            "ads": [_format_ad_dict(a) for a in ads]
        }
    finally:
        db.close()


@app.get("/api/ads/{ad_id}")
def get_ad_by_id(ad_id: int):
    db = SessionLocal()
    try:
        ad = db.query(Ad).filter(Ad.id == ad_id).first()
        if not ad:
            raise HTTPException(status_code=404, detail="Ad campaign not found")
        return _format_ad_dict(ad)
    finally:
        db.close()


@app.post("/api/ads")
def create_ad(payload: AdSchema):
    db = SessionLocal()
    try:
        if not payload.name or not payload.name.strip():
            raise HTTPException(status_code=400, detail="Campaign name is required")

        start_dt = None
        if payload.start_date:
            try:
                start_dt = datetime.fromisoformat(payload.start_date.replace("Z", "+00:00")).replace(tzinfo=None)
            except Exception:
                pass

        end_dt = None
        if payload.end_date:
            try:
                end_dt = datetime.fromisoformat(payload.end_date.replace("Z", "+00:00")).replace(tzinfo=None)
            except Exception:
                pass

        new_ad = Ad(
            name=payload.name.strip(),
            objective=payload.objective or "Awareness",
            platform=payload.platform or "instagram,facebook",
            status=payload.status or "draft",
            primary_text=payload.primary_text,
            headline=payload.headline,
            cta=payload.cta or "Learn More",
            media_path=payload.media_path,
            audience_location=payload.audience_location or "United States",
            audience_age_min=payload.audience_age_min or 18,
            audience_age_max=payload.audience_age_max or 65,
            audience_gender=payload.audience_gender or "all",
            audience_interests=payload.audience_interests,
            daily_budget=payload.daily_budget or 0.0,
            total_budget=payload.total_budget or 0.0,
            start_date=start_dt,
            end_date=end_dt,
            ai_optimized=payload.ai_optimized,
        )
        db.add(new_ad)
        db.commit()
        db.refresh(new_ad)

        print(f"[INFO - ads] Created new ad campaign ID={new_ad.id} name={new_ad.name!r} status={new_ad.status}")
        return {"success": True, "ad_id": new_ad.id, "ad": _format_ad_dict(new_ad)}
    finally:
        db.close()


@app.put("/api/ads/{ad_id}")
def update_ad(ad_id: int, payload: dict):
    db = SessionLocal()
    try:
        ad = db.query(Ad).filter(Ad.id == ad_id).first()
        if not ad:
            raise HTTPException(status_code=404, detail="Ad campaign not found")

        # Update allowed fields dynamically
        for key in [
            "name", "objective", "platform", "status", "primary_text",
            "headline", "cta", "media_path", "audience_location",
            "audience_age_min", "audience_age_max", "audience_gender",
            "audience_interests", "daily_budget", "total_budget",
            "spend", "results", "ai_optimized"
        ]:
            if key in payload and payload[key] is not None:
                setattr(ad, key, payload[key])

        if "start_date" in payload and payload["start_date"]:
            try:
                ad.start_date = datetime.fromisoformat(payload["start_date"].replace("Z", "+00:00")).replace(tzinfo=None)
            except Exception:
                pass
        if "end_date" in payload and payload["end_date"]:
            try:
                ad.end_date = datetime.fromisoformat(payload["end_date"].replace("Z", "+00:00")).replace(tzinfo=None)
            except Exception:
                pass

        ad.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(ad)

        print(f"[INFO - ads] Updated ad campaign ID={ad.id} status={ad.status}")
        return {"success": True, "ad": _format_ad_dict(ad)}
    finally:
        db.close()


@app.delete("/api/ads/{ad_id}")
def delete_ad(ad_id: int):
    db = SessionLocal()
    try:
        ad = db.query(Ad).filter(Ad.id == ad_id).first()
        if not ad:
            raise HTTPException(status_code=404, detail="Ad campaign not found")

        db.delete(ad)
        db.commit()
        print(f"[INFO - ads] Deleted ad campaign ID={ad_id}")
        return {"success": True, "message": "Ad campaign deleted successfully"}
    finally:
        db.close()


class AdGenerateRequest(BaseModel):
    product_service: str = ""
    objective: str = "Awareness"
    platform: str = "instagram,facebook"
    target_audience: str = ""
    campaign_description: str = ""
    daily_budget: float | None = None
    duration_days: int | None = None


@app.post("/api/ads/generate")
def generate_ad_campaign_endpoint(payload: AdGenerateRequest):
    """
    AI Campaign Assistant: Generates a full ad campaign concept, copy variations,
    and targeting recommendations using Gemini AI.
    """
    try:
        result = generate_ad_campaign(
            product_service=payload.product_service,
            objective=payload.objective,
            platform=payload.platform,
            target_audience=payload.target_audience,
            campaign_description=payload.campaign_description,
            daily_budget=payload.daily_budget,
            duration_days=payload.duration_days,
        )
        return {"success": True, "campaign": result}
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[ERROR - ads API] Failed to generate campaign: {exc}")
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(exc)}")


class CreativeGenerateRequest(BaseModel):
    product_service: str = ""
    objective: str = "Awareness"
    target_audience: str = ""
    headline: str = ""
    primary_text: str = ""
    cta: str = ""
    prompt_description: str = ""


@app.post("/api/ads/generate-creative")
def generate_ad_creative_endpoint(payload: CreativeGenerateRequest):
    """
    AI Creative: Generates a visual ad creative image based on campaign context.
    """
    try:
        result = generate_ad_creative(
            product_service=payload.product_service,
            objective=payload.objective,
            target_audience=payload.target_audience,
            headline=payload.headline,
            primary_text=payload.primary_text,
            cta=payload.cta,
            prompt_description=payload.prompt_description,
        )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[ERROR - ads API] Creative generation failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Creative generation failed: {str(exc)}")


@app.post("/api/ads/{ad_id}/publish-meta")
def publish_ad_to_meta_endpoint(ad_id: int):
    """
    Publishes a local Ad campaign to Meta Ads Manager using the 4-step pipeline:
    Campaign (PAUSED) -> Ad Set (PAUSED) -> Ad Creative -> Ad (PAUSED).
    Saves and preserves external Meta IDs in the database.
    """
    db = SessionLocal()
    try:
        ad = db.query(Ad).filter(Ad.id == ad_id).first()
        if not ad:
            raise HTTPException(status_code=404, detail="Ad campaign not found")

        # Update status to publishing
        ad.meta_publish_status = "publishing"
        ad.meta_error_message = None
        db.commit()

        # Call Meta Ads Publisher service
        res = publish_ad_to_meta(ad)

        # Update DB fields with returned Meta IDs
        if res.get("meta_ad_account_id"):
            ad.meta_ad_account_id = res["meta_ad_account_id"]
        if res.get("meta_campaign_id"):
            ad.meta_campaign_id = res["meta_campaign_id"]
        if res.get("meta_adset_id"):
            ad.meta_adset_id = res["meta_adset_id"]
        if res.get("meta_creative_id"):
            ad.meta_creative_id = res["meta_creative_id"]
        if res.get("meta_ad_id"):
            ad.meta_ad_id = res["meta_ad_id"]

        if res["success"]:
            ad.meta_publish_status = "published"
            ad.meta_error_message = None
            ad.meta_published_at = datetime.utcnow()
            if ad.status == "draft":
                ad.status = "scheduled" if ad.start_date else "active"
        else:
            ad.meta_publish_status = "failed"
            ad.meta_error_message = res.get("error") or "Failed to publish to Meta Ads Manager"

        ad.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(ad)

        print(f"[INFO - main.py] Meta publish result for Ad ID={ad.id}: success={res['success']}, meta_ad_id={ad.meta_ad_id}")

        return {
            "success": res["success"],
            "ad": _format_ad_dict(ad),
            "meta_campaign_id": ad.meta_campaign_id,
            "meta_adset_id": ad.meta_adset_id,
            "meta_creative_id": ad.meta_creative_id,
            "meta_ad_id": ad.meta_ad_id,
            "error": ad.meta_error_message,
        }
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[ERROR - main.py] Exception in publish_ad_to_meta_endpoint: {exc}")
        if 'ad' in locals() and ad:
            ad.meta_publish_status = "failed"
            ad.meta_error_message = str(exc)
            db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to publish to Meta: {str(exc)}")
    finally:
        db.close()


@app.get("/api/ads/analytics/insights")
def get_meta_ads_analytics_insights(
    date_preset: str = "last_7d",
    since: str | None = None,
    until: str | None = None,
    ad_id: int | None = None,
):
    """
    Fetches real-time Meta Marketing API performance insights for the account
    or a specific campaign if ad_id is provided.
    """
    object_id = None
    object_type = "account"

    if ad_id:
        db = SessionLocal()
        try:
            ad = db.query(Ad).filter(Ad.id == ad_id).first()
            if ad:
                if ad.meta_ad_id:
                    object_id = ad.meta_ad_id
                    object_type = "ad"
                elif ad.meta_adset_id:
                    object_id = ad.meta_adset_id
                    object_type = "adset"
                elif ad.meta_campaign_id:
                    object_id = ad.meta_campaign_id
                    object_type = "campaign"
        finally:
            db.close()

    res = fetch_meta_insights(
        object_id=object_id,
        object_type=object_type,
        date_preset=date_preset,
        since=since,
        until=until,
    )
    return res


@app.get("/api/ads/{ad_id}/analytics/insights")
def get_ad_meta_insights(
    ad_id: int,
    date_preset: str = "last_7d",
    since: str | None = None,
    until: str | None = None,
):
    """
    Fetches real-time Meta Marketing API performance insights for a specific local campaign/ad.
    """
    db = SessionLocal()
    try:
        ad = db.query(Ad).filter(Ad.id == ad_id).first()
        if not ad:
            raise HTTPException(status_code=404, detail="Ad campaign not found")

        object_id = ad.meta_ad_id or ad.meta_adset_id or ad.meta_campaign_id
        object_type = "ad" if ad.meta_ad_id else "adset" if ad.meta_adset_id else "campaign" if ad.meta_campaign_id else "account"

        res = fetch_meta_insights(
            object_id=object_id,
            object_type=object_type,
            date_preset=date_preset,
            since=since,
            until=until,
        )
        return res
    finally:
        db.close()


class MetaStatusUpdateRequest(BaseModel):
    action: str  # "pause" | "resume"
    target: str = "campaign"  # "campaign" | "adset" | "ad"


@app.post("/api/ads/{ad_id}/meta/status")
def update_ad_meta_status_endpoint(ad_id: int, payload: MetaStatusUpdateRequest):
    """
    Pauses or Resumes a Meta Campaign, Ad Set, or Ad via Marketing Graph API.
    Updates local status and logs activity.
    """
    db = SessionLocal()
    try:
        ad = db.query(Ad).filter(Ad.id == ad_id).first()
        if not ad:
            raise HTTPException(status_code=404, detail="Ad campaign not found")

        target_type = (payload.target or "campaign").lower()
        action_name = (payload.action or "pause").lower()
        target_status = "PAUSED" if action_name == "pause" else "ACTIVE"

        meta_object_id = None
        if target_type == "ad":
            meta_object_id = ad.meta_ad_id
        elif target_type == "adset":
            meta_object_id = ad.meta_adset_id
        else:
            meta_object_id = ad.meta_campaign_id

        if not meta_object_id:
            raise HTTPException(
                status_code=400,
                detail=f"No Meta {target_type} ID linked to this campaign. Publish to Meta first."
            )

        res = update_meta_object_status(meta_object_id, target_status)

        act_key = f"{action_name}_{target_type}"
        if res["success"]:
            if action_name == "pause":
                ad.status = "paused"
            elif action_name == "resume":
                ad.status = "active"

            ad.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(ad)
            log_activity(db, ad.id, meta_object_id, act_key, "success")
            return {"success": True, "ad": _format_ad_dict(ad), "target": target_type, "status": target_status.lower()}
        else:
            log_activity(db, ad.id, meta_object_id, act_key, "failed", res["error"])
            return {"success": False, "error": res["error"]}

    finally:
        db.close()


@app.post("/api/ads/{ad_id}/meta/sync")
def sync_ad_meta_status_endpoint(ad_id: int):
    """
    Queries Meta Marketing API for effective status of Campaign, AdSet, and Ad,
    and updates the local SQLite database.
    """
    db = SessionLocal()
    try:
        ad = db.query(Ad).filter(Ad.id == ad_id).first()
        if not ad:
            raise HTTPException(status_code=404, detail="Ad campaign not found")

        res = sync_ad_meta_status(ad, db)
        return {"success": res["success"], "ad": _format_ad_dict(ad), "statuses": res.get("statuses"), "error": res.get("error")}
    finally:
        db.close()


@app.post("/api/ads/{ad_id}/retry")
def retry_ad_publishing_endpoint(ad_id: int):
    """
    Safely retries Meta publishing for a failed campaign without creating duplicate Meta objects.
    Reuses existing Meta IDs (meta_campaign_id, meta_adset_id, etc.).
    """
    db = SessionLocal()
    try:
        ad = db.query(Ad).filter(Ad.id == ad_id).first()
        if not ad:
            raise HTTPException(status_code=404, detail="Ad campaign not found")

        res = retry_publish_ad(ad, db)
        if res["success"]:
            return {"success": True, "ad": _format_ad_dict(ad), "message": res.get("message")}
        else:
            return {"success": False, "ad": _format_ad_dict(ad), "error": res.get("error")}
    finally:
        db.close()


@app.post("/api/ads/sync-all")
def sync_all_ads_endpoint():
    """
    Triggers an on-demand synchronization of Meta object statuses & insights across all campaigns.
    """
    db = SessionLocal()
    try:
        res = auto_sync_all_ads(db)
        return {"success": True, "res": res}
    finally:
        db.close()


@app.get("/api/ads/{ad_id}/activity-logs")
def get_ad_activity_logs_endpoint(ad_id: int):
    """
    Returns recorded activity logs for the campaign with object_type and error classification.
    """
    db = SessionLocal()
    try:
        logs = db.query(AdActivityLog).filter(AdActivityLog.ad_id == ad_id).order_by(AdActivityLog.timestamp.desc()).all()
        return {
            "success": True,
            "logs": [
                {
                    "id": log.id,
                    "ad_id": log.ad_id,
                    "meta_object_id": log.meta_object_id,
                    "object_type": getattr(log, "object_type", "campaign") or "campaign",
                    "action": log.action,
                    "status": log.status,
                    "error_message": log.error_message,
                    "error_classification": classify_meta_error(log.error_message),
                    "timestamp": _format_utc_iso(log.timestamp),
                }
                for log in logs
            ]
        }
    finally:
        db.close()


# ─── PHASE 8: AI ADS PERFORMANCE OPTIMIZATION APIs ───────────────────────────

@app.post("/api/ads/{ad_id}/optimization/analyze")
def analyze_ad_optimization_endpoint(ad_id: int):
    """
    Triggers AI-powered performance analysis, recommendations, and smart alerts
    based on real Meta Marketing API metrics.
    """
    db = SessionLocal()
    try:
        ad = db.query(Ad).filter(Ad.id == ad_id).first()
        if not ad:
            raise HTTPException(status_code=404, detail="Ad campaign not found")

        res = analyze_ad_performance(ad, db)
        return res
    finally:
        db.close()


@app.get("/api/ads/{ad_id}/optimization/recommendations")
def get_ad_recommendations_endpoint(ad_id: int):
    """
    Returns latest AI performance analysis, recommendations, and smart alerts for campaign.
    """
    db = SessionLocal()
    try:
        analysis = (
            db.query(AdOptimizationAnalysis)
            .filter(AdOptimizationAnalysis.ad_id == ad_id)
            .order_by(AdOptimizationAnalysis.created_at.desc())
            .first()
        )

        recs = (
            db.query(AdRecommendation)
            .filter(AdRecommendation.ad_id == ad_id)
            .order_by(AdRecommendation.created_at.desc())
            .all()
        )

        alerts = (
            db.query(AdAlert)
            .filter(AdAlert.ad_id == ad_id)
            .order_by(AdAlert.created_at.desc())
            .all()
        )

        analysis_dict = None
        if analysis:
            analysis_dict = {
                "id": analysis.id,
                "has_sufficient_data": analysis.has_sufficient_data,
                "overall_summary": analysis.overall_summary,
                "positive_observations": json.loads(analysis.positive_observations) if analysis.positive_observations else [],
                "attention_areas": json.loads(analysis.attention_areas) if analysis.attention_areas else [],
                "possible_reasons": json.loads(analysis.possible_reasons) if analysis.possible_reasons else [],
                "next_steps": json.loads(analysis.next_steps) if analysis.next_steps else [],
                "created_at": _format_utc_iso(analysis.created_at),
            }

        return {
            "success": True,
            "analysis": analysis_dict,
            "recommendations": [
                {
                    "id": r.id,
                    "title": r.title,
                    "explanation": r.explanation,
                    "supporting_metrics": r.supporting_metrics,
                    "confidence": r.confidence,
                    "suggested_action": r.suggested_action,
                    "action_type": r.action_type,
                    "proposed_value": r.proposed_value,
                    "status": r.status,
                    "created_at": _format_utc_iso(r.created_at),
                }
                for r in recs
            ],
            "alerts": [
                {
                    "id": a.id,
                    "alert_type": a.alert_type,
                    "severity": a.severity,
                    "title": a.title,
                    "message": a.message,
                    "is_read": a.is_read,
                    "created_at": _format_utc_iso(a.created_at),
                }
                for a in alerts
            ]
        }
    finally:
        db.close()


class RecActionRequest(BaseModel):
    action: str  # "apply" | "ignore"


@app.post("/api/ads/{ad_id}/optimization/recommendations/{rec_id}/action")
def recommendation_action_endpoint(ad_id: int, rec_id: int, payload: RecActionRequest):
    """
    User Approval Flow: Applies or ignores an AI recommendation.
    Explicit user confirmation required — NEVER auto-executes paid actions or spend changes.
    """
    db = SessionLocal()
    try:
        ad = db.query(Ad).filter(Ad.id == ad_id).first()
        if not ad:
            raise HTTPException(status_code=404, detail="Ad campaign not found")

        rec = db.query(AdRecommendation).filter(AdRecommendation.id == rec_id, AdRecommendation.ad_id == ad_id).first()
        if not rec:
            raise HTTPException(status_code=404, detail="Recommendation not found")

        user_action = (payload.action or "apply").lower()

        if user_action == "apply":
            rec.status = "applied"
            # Apply local copy/headline/cta field update if proposed_value is present
            if rec.proposed_value:
                if rec.action_type == "headline_change":
                    ad.headline = rec.proposed_value
                elif rec.action_type == "copy_change":
                    ad.primary_text = rec.proposed_value
                elif rec.action_type == "cta_change":
                    ad.cta = rec.proposed_value

            ad.updated_at = datetime.utcnow()
            db.commit()

            log_activity(
                db, ad.id, ad.meta_campaign_id, "recommendation_applied", "success", 
                error_message=f"Applied: {rec.title}", object_type="campaign"
            )
            return {"success": True, "message": f"Successfully applied recommendation: '{rec.title}'", "ad": _format_ad_dict(ad)}

        elif user_action == "ignore":
            rec.status = "ignored"
            db.commit()

            log_activity(
                db, ad.id, ad.meta_campaign_id, "recommendation_ignored", "success", 
                error_message=f"Ignored: {rec.title}", object_type="campaign"
            )
            return {"success": True, "message": f"Ignored recommendation: '{rec.title}'"}

        else:
            raise HTTPException(status_code=400, detail="Invalid action. Must be 'apply' or 'ignore'.")

    finally:
        db.close()


class VariationGenerateRequest(BaseModel):
    prompt_hint: str = ""
    count: int = 3


@app.post("/api/ads/{ad_id}/optimization/variations")
def generate_variations_endpoint(ad_id: int, payload: VariationGenerateRequest):
    """
    Generates alternative AI ad copy/headline/CTA draft variations.
    Does NOT automatically publish variations.
    """
    db = SessionLocal()
    try:
        ad = db.query(Ad).filter(Ad.id == ad_id).first()
        if not ad:
            raise HTTPException(status_code=404, detail="Ad campaign not found")

        vars_objs = generate_ad_variations(ad, db, count=payload.count or 3, prompt_hint=payload.prompt_hint)
        return {
            "success": True,
            "count": len(vars_objs),
            "variations": [_format_variation_dict(v) for v in vars_objs]
        }
    finally:
        db.close()


@app.get("/api/ads/{ad_id}/optimization/variations")
def get_ad_variations_endpoint(ad_id: int):
    """
    Returns all saved draft/applied variations for campaign A/B comparison.
    """
    db = SessionLocal()
    try:
        vars_objs = db.query(AdVariation).filter(AdVariation.ad_id == ad_id).order_by(AdVariation.created_at.desc()).all()
        return {
            "success": True,
            "variations": [_format_variation_dict(v) for v in vars_objs]
        }
    finally:
        db.close()


@app.post("/api/ads/{ad_id}/optimization/variations/{var_id}/publish-meta")
def publish_variation_to_meta_endpoint(ad_id: int, var_id: int):
    """
    User-Controlled Variation Publishing Flow: Publishes a specific ad variation
    as a separate Meta Ad under the campaign's existing Ad Set.
    CRITICAL: Always created with status="PAUSED" by default.
    Requires explicit user action — NEVER auto-published by AI.
    """
    db = SessionLocal()
    try:
        ad = db.query(Ad).filter(Ad.id == ad_id).first()
        if not ad:
            raise HTTPException(status_code=404, detail="Ad campaign not found")

        var_obj = db.query(AdVariation).filter(AdVariation.id == var_id, AdVariation.ad_id == ad_id).first()
        if not var_obj:
            raise HTTPException(status_code=404, detail="Ad variation not found")

        log_activity(
            db, ad.id, getattr(var_obj, "meta_ad_id", None) or ad.meta_campaign_id,
            "variation_publish_requested", "success",
            error_message=f"Publish requested for variation: '{var_obj.variation_name}'", object_type="ad"
        )

        var_obj.meta_publish_status = "publishing"
        var_obj.meta_error_message = None
        db.commit()

        res = publish_variation_to_meta(ad, var_obj)

        if res.get("meta_creative_id"):
            var_obj.meta_creative_id = res["meta_creative_id"]
        if res.get("meta_ad_id"):
            var_obj.meta_ad_id = res["meta_ad_id"]

        if res["success"]:
            var_obj.meta_publish_status = "published"
            var_obj.meta_ad_status = "PAUSED"
            var_obj.meta_error_message = None
            var_obj.meta_published_at = datetime.utcnow()
            var_obj.status = "selected"

            log_activity(
                db, ad.id, var_obj.meta_ad_id, "variation_published_meta", "success",
                error_message=f"Published variation '{var_obj.variation_name}' to Meta (PAUSED)", object_type="ad"
            )
        else:
            var_obj.meta_publish_status = "failed"
            var_obj.meta_error_message = res.get("error") or "Failed to publish variation to Meta Ads Manager"

            log_activity(
                db, ad.id, var_obj.meta_ad_id, "variation_publish_failed", "failed",
                error_message=res.get("error"), object_type="ad"
            )

        db.commit()
        db.refresh(var_obj)

        return {
            "success": res["success"],
            "variation": _format_variation_dict(var_obj),
            "meta_creative_id": var_obj.meta_creative_id,
            "meta_ad_id": var_obj.meta_ad_id,
            "error": var_obj.meta_error_message,
        }
    finally:
        db.close()


@app.post("/api/ads/{ad_id}/optimization/variations/sync")
def sync_variations_meta_performance_endpoint(ad_id: int):
    """
    Syncs performance metrics from Meta Marketing API for all published variations of a campaign
    using their individual Meta Ad IDs.
    """
    db = SessionLocal()
    try:
        ad = db.query(Ad).filter(Ad.id == ad_id).first()
        if not ad:
            raise HTTPException(status_code=404, detail="Ad campaign not found")

        variations = db.query(AdVariation).filter(AdVariation.ad_id == ad_id).all()
        synced_count = 0

        for v in variations:
            if v.meta_ad_id:
                try:
                    insights = fetch_meta_insights(object_id=v.meta_ad_id, object_type="ad")
                    if insights.get("has_data") and insights.get("metrics"):
                        m = insights["metrics"]
                        v.impressions = int(m.get("impressions", v.impressions or 0))
                        v.clicks = int(m.get("clicks", v.clicks or 0))
                        v.spend = float(m.get("spend", v.spend or 0.0))
                        v.ctr = float(m.get("ctr", v.ctr or 0.0))
                        v.cpc = float(m.get("cpc", v.cpc or 0.0))
                        v.results = int(m.get("results", v.results or 0))
                        v.last_synced_at = datetime.utcnow()
                        synced_count += 1
                except Exception as exc:
                    print(f"[WARNING - sync_variations] Failed syncing metrics for variation {v.id}: {exc}")

        db.commit()

        log_activity(
            db, ad.id, ad.meta_campaign_id, "variation_metrics_synced", "success",
            error_message=f"Synced performance metrics for {synced_count} variation(s)", object_type="campaign"
        )

        updated_vars = db.query(AdVariation).filter(AdVariation.ad_id == ad_id).order_by(AdVariation.created_at.desc()).all()
        return {
            "success": True,
            "synced_count": synced_count,
            "variations": [_format_variation_dict(v) for v in updated_vars]
        }
    finally:
        db.close()



