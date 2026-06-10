from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Request
from sqlalchemy import text
from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.db.session import engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info(f"{settings.APP_NAME} starting up...")
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connection successful")
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        raise
    yield
    logger.info(f"{settings.APP_NAME} shutting down...")

app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG, lifespan=lifespan)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"--> {request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"<-- {response.status_code} {request.url.path}")
    return response

@app.get("/health")
def health_check():
    return {"status": "ok", "app": settings.APP_NAME}