from collections.abc import Generator

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.session import SessionLocal


# --- Plain DB session: use for reads and auth routes ---

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- Audit-aware DB session: use for all writes ---

def get_audited_db(user_id: int) -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        db.execute(text("SET LOCAL app.current_user_id = :uid"), {"uid": str(user_id)})
        yield db
    finally:
        db.close()


# --- FastAPI dependency factory for audited writes ---

def audited_db(current_user_id: int):
    def dependency() -> Generator[Session, None, None]:
        yield from get_audited_db(current_user_id)
    return dependency