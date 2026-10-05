"""
Database tables ka structure. Har post yahan store hogi,
including uploaded image ka reference.
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, Float, ForeignKey
from sqlalchemy.orm import declarative_base, relationship
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


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String, nullable=False)  # "instagram" or "facebook"
    type = Column(String, nullable=False)      # "comment" or "dm"
    
    external_user_id = Column(String, nullable=False, index=True)
    external_username = Column(String, nullable=False)
    
    # AI Metadata
    sentiment = Column(String, default="neutral") # "positive", "neutral", "negative"
    is_flagged = Column(Boolean, default=False)
    is_unread = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class CommunitySettings(Base):
    __tablename__ = "community_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    comments_auto_reply = Column(Boolean, default=True)
    dm_auto_reply = Column(Boolean, default=True)


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    
    external_message_id = Column(String, nullable=False, unique=True, index=True)
    sender = Column(String, nullable=False)    # "user" or "brand"
    text = Column(Text, nullable=False)
    media_url = Column(String, nullable=True)  # URL to attached image/media
    
    # AI Suggested Reply (if sender == "user")
    ai_suggested_reply = Column(Text, nullable=True)
    is_auto_replied = Column(Boolean, default=False)
    reply_status = Column(String, nullable=True) # "pending", "success", "failed"
    error_message = Column(String, nullable=True)
    
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")


class Ad(Base):
    __tablename__ = "ads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    objective = Column(String, default="Awareness")
    platform = Column(String, default="instagram,facebook")
    status = Column(String, default="draft")  # draft | scheduled | active | paused | completed | failed

    primary_text = Column(Text, nullable=True)
    headline = Column(String, nullable=True)
    cta = Column(String, default="Learn More")
    media_path = Column(String, nullable=True)

    # Audience
    audience_location = Column(String, default="United States")
    audience_age_min = Column(Integer, default=18)
    audience_age_max = Column(Integer, default=65)
    audience_gender = Column(String, default="all")
    audience_interests = Column(String, nullable=True)

    # Budget & Schedule
    daily_budget = Column(Float, default=0.0)
    total_budget = Column(Float, default=0.0)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)

    # Performance stats
    impressions = Column(Integer, default=0)
    reach = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    spend = Column(Float, default=0.0)
    ctr = Column(Float, default=0.0)
    cpc = Column(Float, default=0.0)
    cpm = Column(Float, default=0.0)
    results = Column(Integer, default=0)

    ai_optimized = Column(Boolean, default=False)
    error_message = Column(String, nullable=True)

    # Meta Ads API Tracking & Publishing
    meta_ad_account_id = Column(String, nullable=True)
    meta_campaign_id = Column(String, nullable=True)
    meta_adset_id = Column(String, nullable=True)
    meta_creative_id = Column(String, nullable=True)
    meta_ad_id = Column(String, nullable=True)
    meta_campaign_status = Column(String, default="PAUSED")  # PAUSED | ACTIVE | ARCHIVED
    meta_adset_status = Column(String, default="PAUSED")     # PAUSED | ACTIVE | ARCHIVED
    meta_ad_status = Column(String, default="PAUSED")        # PAUSED | ACTIVE | ARCHIVED
    meta_publish_status = Column(String, default="not_published")  # not_published | publishing | published | failed
    meta_error_message = Column(String, nullable=True)
    meta_published_at = Column(DateTime, nullable=True)
    last_synced_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AdActivityLog(Base):
    __tablename__ = "ad_activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    ad_id = Column(Integer, ForeignKey("ads.id"), nullable=False, index=True)
    meta_object_id = Column(String, nullable=True)
    object_type = Column(String, default="campaign")  # "campaign" | "adset" | "ad" | "creative" | "account"
    action = Column(String, nullable=False)  # e.g. "publish", "pause_campaign", "resume_campaign", "sync_status", "auto_sync", "retry_publish", "optimization_analyzed", "recommendation_applied"
    status = Column(String, nullable=False)  # "success" | "failed"
    error_message = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)


class AdOptimizationAnalysis(Base):
    __tablename__ = "ad_optimization_analyses"

    id = Column(Integer, primary_key=True, index=True)
    ad_id = Column(Integer, ForeignKey("ads.id"), nullable=False, index=True)
    has_sufficient_data = Column(Boolean, default=False)
    overall_summary = Column(Text, nullable=True)
    positive_observations = Column(Text, nullable=True)  # JSON string
    attention_areas = Column(Text, nullable=True)        # JSON string
    possible_reasons = Column(Text, nullable=True)       # JSON string
    next_steps = Column(Text, nullable=True)             # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)


class AdRecommendation(Base):
    __tablename__ = "ad_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    ad_id = Column(Integer, ForeignKey("ads.id"), nullable=False, index=True)
    analysis_id = Column(Integer, ForeignKey("ad_optimization_analyses.id"), nullable=True)
    title = Column(String, nullable=False)
    explanation = Column(Text, nullable=True)
    supporting_metrics = Column(String, nullable=True)
    confidence = Column(String, default="Medium")
    suggested_action = Column(Text, nullable=True)
    action_type = Column(String, default="copy_change")  # headline_change | copy_change | cta_change | audience_review | budget_review
    proposed_value = Column(Text, nullable=True)
    status = Column(String, default="pending")  # pending | applied | ignored
    created_at = Column(DateTime, default=datetime.utcnow)


class AdVariation(Base):
    __tablename__ = "ad_variations"

    id = Column(Integer, primary_key=True, index=True)
    ad_id = Column(Integer, ForeignKey("ads.id"), nullable=False, index=True)
    variation_name = Column(String, nullable=False)
    primary_text = Column(Text, nullable=True)
    headline = Column(String, nullable=True)
    cta = Column(String, default="Learn More")
    description = Column(Text, nullable=True)
    creative_concept = Column(Text, nullable=True)
    status = Column(String, default="draft")  # draft | selected | applied
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    ctr = Column(Float, default=0.0)
    cpc = Column(Float, default=0.0)
    spend = Column(Float, default=0.0)
    results = Column(Integer, default=0)

    # Meta Ads API Tracking per variation
    meta_creative_id = Column(String, nullable=True)
    meta_ad_id = Column(String, nullable=True)
    meta_ad_status = Column(String, default="PAUSED")
    meta_publish_status = Column(String, default="not_published")  # not_published | publishing | published | failed
    meta_error_message = Column(String, nullable=True)
    meta_published_at = Column(DateTime, nullable=True)
    last_synced_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)


class AdAlert(Base):
    __tablename__ = "ad_alerts"

    id = Column(Integer, primary_key=True, index=True)
    ad_id = Column(Integer, ForeignKey("ads.id"), nullable=False, index=True)
    alert_type = Column(String, nullable=False)  # no_delivery | billing_restriction | expired_token | high_cpc | low_ctr | campaign_paused
    severity = Column(String, default="info")     # info | warning | critical
    title = Column(String, nullable=False)
    message = Column(Text, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)



