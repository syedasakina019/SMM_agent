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
import zoneinfo
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

def get_best_posting_time(timezone_str: str) -> dict:
    """
    Placeholder: general industry data ke mutabiq ek 'best time' deta hai.
    TODO (Phase 4): Isay Meta Insights API ke real data se replace karna hai.
    """
    tz = zoneinfo.ZoneInfo(timezone_str)
    now_local = datetime.now(tz)
    
    # Target 7:00 PM (19:00) in the user's local timezone
    target_local = now_local.replace(hour=19, minute=0, second=0, microsecond=0)
    if target_local <= now_local:
        target_local += timedelta(days=1)

    # Convert that exact local time back to UTC so the DB/Scheduler can handle it
    target_utc = target_local.astimezone(zoneinfo.ZoneInfo("UTC"))
    
    return {
        "suggested_time": target_utc.isoformat().replace("+00:00", "Z"),
        "reason": (
            f"Placeholder estimate (7:00 PM in {timezone_str}). "
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

            if result.get("success"):
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


def check_due_scheduled_ads() -> None:
    """
    Checks for scheduled Ad campaigns whose start_date has arrived.
    Ensures safe handling:
    - If not published to Meta, publishes them (in PAUSED status by default).
    - Never auto-activates spending or changes Meta payment settings.
    """
    from app.database.models import Ad
    from app.agents.meta_ads_publisher import publish_ad_to_meta

    db = SessionLocal()
    try:
        now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
        due_ads = (
            db.query(Ad)
            .filter(Ad.status == "scheduled")
            .filter(Ad.start_date <= now_utc)
            .all()
        )

        if not due_ads:
            return

        for ad in due_ads:
            logger.info("Scheduler: processing due scheduled ad id=%d ('%s')", ad.id, ad.name)
            if not ad.meta_campaign_id:
                pub_res = publish_ad_to_meta(ad)
                if pub_res.get("success"):
                    ad.meta_ad_account_id = pub_res.get("meta_ad_account_id")
                    ad.meta_campaign_id = pub_res.get("meta_campaign_id")
                    ad.meta_adset_id = pub_res.get("meta_adset_id")
                    ad.meta_creative_id = pub_res.get("meta_creative_id")
                    ad.meta_ad_id = pub_res.get("meta_ad_id")
                    ad.meta_publish_status = "published"
                    ad.meta_published_at = datetime.utcnow()
                    ad.status = "paused"  # Keep PAUSED on Meta by default
                    db.commit()
                else:
                    ad.meta_publish_status = "failed"
                    ad.meta_error_message = pub_res.get("error")
                    db.commit()
            else:
                ad.status = "paused"
                db.commit()

    except Exception as exc:
        logger.error("Scheduler: error in check_due_scheduled_ads: %s", exc)
        db.rollback()
    finally:
        db.close()


def sync_all_meta_ads_job() -> None:
    """
    Periodic background job that synchronizes live Meta object statuses and performance insights
    for all published Meta ads.
    Runs with max_instances=1 to prevent concurrent or overlapping runs.
    """
    from app.agents.meta_ads_manager import auto_sync_all_ads
    db = SessionLocal()
    try:
        auto_sync_all_ads(db)
    except Exception as exc:
        logger.error("Scheduler: error in sync_all_meta_ads_job: %s", exc)
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
        trigger=IntervalTrigger(seconds=10, timezone="UTC"),
        id="check_due_posts",
        name="Check and publish due scheduled posts",
        replace_existing=True,
        max_instances=1,   # prevent overlapping runs
    )

    scheduler.add_job(
        check_due_scheduled_ads,
        trigger=IntervalTrigger(seconds=30, timezone="UTC"),
        id="check_due_scheduled_ads",
        name="Check due scheduled ad campaigns",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.add_job(
        sync_all_meta_ads_job,
        trigger=IntervalTrigger(minutes=15, timezone="UTC"),
        id="sync_all_meta_ads_job",
        name="Periodic Meta Ads status & insights auto-sync",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.start()
    logger.info("Scheduler started — posts (10s), scheduled ads (30s), Meta ads auto-sync (15m)")

    # Catch overdue posts & ads immediately on startup (server-restart safety)
    check_due_posts()
    check_due_scheduled_ads()

    return scheduler

