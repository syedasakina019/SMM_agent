"""
Database tables ka structure. Har post yahan store hogi,
including uploaded image ka reference.
"""

from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    caption = Column(Text, nullable=False)
    hashtags = Column(String, nullable=True)
    image_path = Column(String, nullable=True)   # local path ya URL, uploaded image ka
    platforms = Column(String, default="instagram")  # "instagram,facebook"

    # Status lifecycle: draft → scheduled → publishing → published | failed | cancelled
    status = Column(String, default="draft")
    schedule_mode = Column(String, default="ai")   # "ai" | "manual" | "immediate"
    scheduled_time = Column(DateTime, nullable=True)  # UTC datetime for scheduled posts

    created_at = Column(DateTime, default=datetime.utcnow)
    published_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    external_post_id = Column(String, nullable=True)

    # Safe error detail when publishing fails — never contains secrets/tokens
    error_message = Column(String, nullable=True)
