import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from app.database.models import Base

from pathlib import Path

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
raw_db_url = os.getenv("DATABASE_URL", "sqlite:///./smm_agent.db")

if raw_db_url in ("sqlite:///./smm_agent.db", "sqlite:///smm_agent.db"):
    db_path = BASE_DIR / "smm_agent.db"
    DATABASE_URL = f"sqlite:///{db_path}"
else:
    DATABASE_URL = raw_db_url

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


from app.database.migrations import run_migrations


def init_db():
    Base.metadata.create_all(bind=engine)
    run_migrations(engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
