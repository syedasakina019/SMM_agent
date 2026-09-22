"""
SCHEDULER MODULE
================
Two responsibilities:

1. get_best_posting_time() — legacy placeholder for the best-time suggestion
   endpoint (/api/best-time). Phase 4 will replace this with real analytics.

2. APScheduler engine — a BackgroundScheduler that checks every 60 seconds
   for posts whose scheduled_time has passed and publishes them via Meta API.
   Runs entirely server-side; browser/frontend availability is irrelevant.
"""

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import timedelta

from app.database.db import SessionLocal
from app.database.models import Post
from app.agents.meta_publisher import publish_to_meta

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# LEGACY: best-time placeholder (Phase 1 / 2)
# ─────────────────────────────────────────────────────────────────────────────

def get_best_posting_time() -> dict:
    """
    Placeholder: general industry data ke mutabiq ek 'best time' deta hai.
    TODO (Phase 4): Isay Meta Insights API ke real data se replace karna hai.
    """
    now = datetime.utcnow()
    target = now.replace(hour=19, minute=0, second=0, microsecond=0)
    if target < now:
        target += timedelta(days=1)

    return {
        "suggested_time": target.isoformat(),
        "reason": (
            "Placeholder estimate (general best-practice time). "
            "Will be replaced with real audience-activity data in Phase 4."
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# APSCHEDULER ENGINE
# ─────────────────────────────────────────────────────────────────────────────

def check_due_posts() -> None:
    """
    Called every 60 s by APScheduler.

    Finds all posts where:
      - status == 'scheduled'
      - scheduled_time <= now (UTC, timezone-aware comparison)

    Transitions each post through: scheduled → publishing → published | failed

    Uses a separate DB session per run so it is isolated from request sessions.
    Guards against double-publishing by setting status='publishing' atomically
    before calling the Meta API.
    """
    db = SessionLocal()
    try:
        now_utc = datetime.now(timezone.utc).replace(tzinfo=None)  # compare with naive UTC stored in DB

        due_posts = (
            db.query(Post)
            .filter(Post.status == "scheduled")
            .filter(Post.scheduled_time <= now_utc)
            .all()
        )

        if not due_posts:
            return

        logger.info("Scheduler: found %d due post(s)", len(due_posts))

        for post in due_posts:
            # ── Guard: mark as 'publishing' immediately to prevent double-run ──
            post.status = "publishing"
            db.commit()

            logger.info("Scheduler: publishing post id=%d to %s", post.id, post.platforms)

            try:
                result = publish_to_meta(post)
            except Exception as exc:
                result = {"success": False, "error": f"Unexpected error: {exc}"}

            if result["success"]:
                post.status = "published"
                post.published_at = datetime.utcnow()
                post.external_post_id = result.get("external_id")
                post.error_message = None
                logger.info("Scheduler: post id=%d published (external_id=%s)", post.id, post.external_post_id)
            else:
                post.status = "failed"
                post.error_message = result.get("error", "Unknown error")
                logger.warning("Scheduler: post id=%d failed: %s", post.id, post.error_message)

            db.commit()

    except Exception as exc:
        logger.error("Scheduler: unhandled error in check_due_posts: %s", exc)
        db.rollback()
    finally:
        db.close()


def start_scheduler() -> BackgroundScheduler:
    """
    Create, configure and start the APScheduler BackgroundScheduler.

    Returns the running scheduler instance so it can be shut down cleanly
    in the FastAPI lifespan.

    On startup it immediately runs check_due_posts() once to catch any posts
    that became due while the server was offline (handles server restarts).
    """
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(
        check_due_posts,
        trigger=IntervalTrigger(seconds=60, timezone="UTC"),
        id="check_due_posts",
        name="Check and publish due scheduled posts",
        replace_existing=True,
        max_instances=1,   # prevent overlapping runs
    )
    scheduler.start()
    logger.info("Scheduler started — checking for due posts every 60 s")

    # Catch overdue posts immediately on startup (server-restart safety)
    check_due_posts()

    return scheduler
