from sqlalchemy import inspect, text

def run_migrations(engine):
    """
    Safely inspects existing database tables and adds missing columns.
    Preserves all existing tables, rows, and data.
    Safe to run multiple times (idempotent).
    """
    if "sqlite" not in str(engine.url):
        return

    with engine.connect() as conn:
        inspector = inspect(conn)
        if inspector.has_table("messages"):
            columns = inspector.get_columns("messages")
            existing_col_names = {col["name"] for col in columns}

            columns_to_add = [
                ("media_url", "TEXT"),
                ("is_auto_replied", "BOOLEAN DEFAULT 0"),
                ("reply_status", "TEXT"),
                ("error_message", "TEXT"),
            ]

            for col_name, col_type in columns_to_add:
                if col_name not in existing_col_names:
                    print(f"[MIGRATION] Adding missing column '{col_name}' to 'messages' table...")
                    conn.execute(text(f"ALTER TABLE messages ADD COLUMN {col_name} {col_type};"))
            
            conn.commit()

        if inspector.has_table("ads"):
            columns = inspector.get_columns("ads")
            existing_col_names = {col["name"] for col in columns}

            ads_columns_to_add = [
                ("impressions", "INTEGER DEFAULT 0"),
                ("reach", "INTEGER DEFAULT 0"),
                ("clicks", "INTEGER DEFAULT 0"),
                ("ctr", "FLOAT DEFAULT 0.0"),
                ("cpc", "FLOAT DEFAULT 0.0"),
                ("cpm", "FLOAT DEFAULT 0.0"),
                ("meta_ad_account_id", "TEXT"),
                ("meta_campaign_id", "TEXT"),
                ("meta_adset_id", "TEXT"),
                ("meta_creative_id", "TEXT"),
                ("meta_ad_id", "TEXT"),
                ("meta_campaign_status", "TEXT DEFAULT 'PAUSED'"),
                ("meta_adset_status", "TEXT DEFAULT 'PAUSED'"),
                ("meta_ad_status", "TEXT DEFAULT 'PAUSED'"),
                ("meta_publish_status", "TEXT DEFAULT 'not_published'"),
                ("meta_error_message", "TEXT"),
                ("meta_published_at", "DATETIME"),
                ("last_synced_at", "DATETIME"),
            ]

            for col_name, col_type in ads_columns_to_add:
                if col_name not in existing_col_names:
                    print(f"[MIGRATION] Adding missing column '{col_name}' to 'ads' table...")
                    conn.execute(text(f"ALTER TABLE ads ADD COLUMN {col_name} {col_type};"))
            
            conn.commit()

        if inspector.has_table("ad_activity_logs"):
            log_columns = inspector.get_columns("ad_activity_logs")
            log_col_names = {col["name"] for col in log_columns}

            if "object_type" not in log_col_names:
                print("[MIGRATION] Adding missing column 'object_type' to 'ad_activity_logs' table...")
                conn.execute(text("ALTER TABLE ad_activity_logs ADD COLUMN object_type TEXT DEFAULT 'campaign';"))
                conn.commit()

        if inspector.has_table("ad_variations"):
            var_columns = inspector.get_columns("ad_variations")
            var_col_names = {col["name"] for col in var_columns}

            var_columns_to_add = [
                ("meta_creative_id", "TEXT"),
                ("meta_ad_id", "TEXT"),
                ("meta_ad_status", "TEXT DEFAULT 'PAUSED'"),
                ("meta_publish_status", "TEXT DEFAULT 'not_published'"),
                ("meta_error_message", "TEXT"),
                ("meta_published_at", "DATETIME"),
                ("last_synced_at", "DATETIME"),
            ]

            for col_name, col_type in var_columns_to_add:
                if col_name not in var_col_names:
                    print(f"[MIGRATION] Adding missing column '{col_name}' to 'ad_variations' table...")
                    conn.execute(text(f"ALTER TABLE ad_variations ADD COLUMN {col_name} {col_type};"))
            
            conn.commit()


