"""
MAIN APPLICATION (Backend Entry Point)
=======================================
Frontend (navy/purple dashboard) yahan se ye endpoints call karega:

  GET    /api/posts              → saari posts ki list
  POST   /api/posts              → new post save karna
  DELETE /api/posts/{id}         → post delete karna
  POST   /api/posts/{id}/cancel  → scheduled post cancel karna
  POST   /api/posts/{id}/publish → post immediately publish karna
  POST   /api/analyze-image      → image upload → AI caption/hashtags
  GET    /api/best-time          → AI-suggested posting time
"""

import json
import logging
import os
import shutil
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.agents.content_agent import generate_caption_from_image
from app.agents.meta_publisher import publish_to_meta
from app.agents.scheduler import get_best_posting_time, start_scheduler
from app.database.db import init_db, SessionLocal
from app.database.models import Post

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# DB migration helper — add new columns to existing SQLite DB without Alembic
# ─────────────────────────────────────────────────────────────────────────────

def _migrate_db():
    """
    Adds columns that didn't exist in older versions of the DB.
    SQLite does not support ALTER TABLE ADD COLUMN IF NOT EXISTS,
    so we catch the OperationalError and ignore it.
    """
    from sqlalchemy import text
    from app.database.db import engine

    migrations = [
        "ALTER TABLE posts ADD COLUMN error_message VARCHAR",
        "ALTER TABLE posts ADD COLUMN cancelled_at DATETIME",
    ]
    with engine.connect() as conn:
        for stmt in migrations:
            try:
                conn.execute(text(stmt))
                conn.commit()
                logger.info("Migration applied: %s", stmt)
            except Exception:
                pass   # column already exists — safe to ignore


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI lifespan — start/stop scheduler alongside the app
# ─────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _migrate_db()
    scheduler = start_scheduler()
    logger.info("Application startup complete.")
    yield
    scheduler.shutdown(wait=False)
    logger.info("Application shutdown complete.")


app = FastAPI(title="AI Social Media Agent - Backend API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Uploaded images yahan store hongi, aur /uploads URL se accessible hongi
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _serialize_post(p: Post) -> dict:
    """Serialize a Post ORM object to a JSON-safe dict."""
    return {
        "id": p.id,
        "caption": p.caption,
        "hashtags": p.hashtags,
        "image_path": p.image_path,
        "platforms": p.platforms,
        "status": p.status,
        "schedule_mode": p.schedule_mode,
        "scheduled_time": p.scheduled_time.isoformat() if p.scheduled_time else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "published_at": p.published_at.isoformat() if p.published_at else None,
        "cancelled_at": p.cancelled_at.isoformat() if p.cancelled_at else None,
        "external_post_id": p.external_post_id,
        "error_message": p.error_message,
    }


# ─────────────────────────────────────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/")
def home():
    return {"message": "AI Social Media Agent backend is running!"}


# ── Analyze image & generate caption ─────────────────────────────────────────

@app.post("/api/analyze-image")
async def analyze_image(
    image: UploadFile = File(...),
    instructions: str = Form(None),
):
    """
    Frontend ka 'Analyze Image & Generate Caption' button isay call karega.
    Image upload hoti hai, Gemini usay 'dekh' kar caption/hashtags likhta hai.
    """
    image_bytes = await image.read()
    media_type = image.content_type or "image/jpeg"

    result = generate_caption_from_image(image_bytes, media_type, instructions)

    # Save image so it can be referenced later in posts
    filename = f"{datetime.utcnow().timestamp()}_{image.filename}"
    file_path = UPLOAD_DIR / filename
    with open(file_path, "wb") as f:
        f.write(image_bytes)

    return {
        "caption": result["caption"],
        "hashtags": result["hashtags"],
        "image_path": f"/uploads/{filename}",
    }


# ── Best posting time ─────────────────────────────────────────────────────────

@app.get("/api/best-time")
def best_time():
    """Frontend ka 'Let AI pick the best time' option isay call karega."""
    return get_best_posting_time()


# ── List posts ────────────────────────────────────────────────────────────────

@app.get("/api/posts")
def get_all_posts():
    """Frontend ka Posts page isay call karega saari posts dikhane ke liye."""
    db = SessionLocal()
    try:
        posts = db.query(Post).order_by(Post.created_at.desc()).all()
        return [_serialize_post(p) for p in posts]
    finally:
        db.close()


# ── Create / save a post ──────────────────────────────────────────────────────

@app.post("/api/posts")
def save_post(
    caption: str = Form(...),
    hashtags: str = Form(""),
    image_path: str = Form(None),
    platforms: str = Form("instagram"),
    schedule_mode: str = Form("immediate"),
    scheduled_time: str = Form(None),
):
    """
    Frontend ka 'Save Post' button isay call karega.
    schedule_mode: 'immediate' | 'ai' | 'manual'
    scheduled_time: ISO-8601 string (only for manual mode)
    """
    # Normalise platforms — frontend sends JSON array string e.g. '["Instagram","Facebook"]'
    try:
        plat_list = json.loads(platforms)
        platforms_str = ",".join(p.lower() for p in plat_list)
    except Exception:
        platforms_str = platforms.lower()

    # Parse scheduled_time
    parsed_scheduled_time = None
    if scheduled_time:
        try:
            parsed_scheduled_time = datetime.fromisoformat(scheduled_time.replace("Z", "+00:00"))
            # Store as naive UTC
            if parsed_scheduled_time.tzinfo is not None:
                parsed_scheduled_time = parsed_scheduled_time.astimezone(timezone.utc).replace(tzinfo=None)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid scheduled_time format. Use ISO-8601.")

    # Determine initial status
    if schedule_mode == "immediate":
        status = "draft"   # will be published on demand via /publish
    elif schedule_mode in ("ai", "manual") and parsed_scheduled_time:
        status = "scheduled"
    else:
        status = "draft"

    db = SessionLocal()
    try:
        new_post = Post(
            caption=caption,
            hashtags=hashtags,
            image_path=image_path,
            platforms=platforms_str,
            schedule_mode=schedule_mode,
            scheduled_time=parsed_scheduled_time,
            status=status,
        )
        db.add(new_post)
        db.commit()
        db.refresh(new_post)
        return {"success": True, "post_id": new_post.id, "post": _serialize_post(new_post)}
    finally:
        db.close()


# ── Delete a post ─────────────────────────────────────────────────────────────

@app.delete("/api/posts/{post_id}")
def delete_post(post_id: int):
    """
    Delete a post from the database.
    Refuses to delete a post currently being published (status='publishing').
    """
    db = SessionLocal()
    try:
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        if post.status == "publishing":
            raise HTTPException(
                status_code=409,
                detail="Cannot delete a post that is currently being published. Try again in a moment.",
            )
        db.delete(post)
        db.commit()
        return {"success": True, "deleted_id": post_id}
    finally:
        db.close()


# ── Cancel a scheduled post ───────────────────────────────────────────────────

@app.post("/api/posts/{post_id}/cancel")
def cancel_post(post_id: int):
    """
    Cancel a scheduled post (status: scheduled → cancelled).
    Only works on posts with status 'scheduled' or 'draft'.
    """
    db = SessionLocal()
    try:
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        if post.status not in ("scheduled", "draft"):
            raise HTTPException(
                status_code=409,
                detail=f"Cannot cancel a post with status '{post.status}'.",
            )
        post.status = "cancelled"
        post.cancelled_at = datetime.utcnow()
        db.commit()
        db.refresh(post)
        return {"success": True, "post": _serialize_post(post)}
    finally:
        db.close()


# ── Publish now (immediately) ─────────────────────────────────────────────────

@app.post("/api/posts/{post_id}/publish")
def publish_now(post_id: int):
    """
    Immediately attempt to publish a post via Meta API.
    Allowed for statuses: draft, scheduled, failed, cancelled.
    """
    db = SessionLocal()
    try:
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        if post.status in ("publishing", "published"):
            raise HTTPException(
                status_code=409,
                detail=f"Post is already '{post.status}'.",
            )

        post.status = "publishing"
        db.commit()

        try:
            result = publish_to_meta(post)
        except Exception as exc:
            result = {"success": False, "error": f"Unexpected error: {exc}"}

        if result["success"]:
            post.status = "published"
            post.published_at = datetime.utcnow()
            post.external_post_id = result.get("external_id")
            post.error_message = None
        else:
            post.status = "failed"
            post.error_message = result.get("error", "Unknown error")

        db.commit()
        db.refresh(post)
        return {"success": result["success"], "post": _serialize_post(post)}
    finally:
        db.close()


# ============================================
# AGLE PHASES YAHAN ADD HONGE:
# /api/comments        → Phase 2 (Community Agent)
# /api/campaigns       → Phase 3 (Ads Agent)
# /api/analytics       → Phase 4 (Analytics Agent)
# ============================================
