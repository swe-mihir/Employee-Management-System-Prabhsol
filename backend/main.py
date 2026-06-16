from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Request
from fastapi.openapi.utils import get_openapi
from sqlalchemy import text
from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.db.session import engine

from fastapi.security import HTTPBearer
import asyncio
from datetime import date, datetime, timedelta

from fastapi.middleware.cors import CORSMiddleware

from app.auth.router import router as auth_router
from app.employees.router import router as employees_router
from app.attendance.router import router as attendance_router
from app.users.router import router as users_router
from app.payroll.router import router as payroll_router

security = HTTPBearer()

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://192.168.56.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(employees_router)
app.include_router(attendance_router)
app.include_router(users_router)
app.include_router(payroll_router)

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="EMS API",
        version="1.0.0",
        routes=app.routes,
    )
    openapi_schema["components"]["securitySchemes"] = {
        "bearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
    }
    openapi_schema["security"] = [{"bearerAuth": []}]
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"--> {request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"<-- {response.status_code} {request.url.path}")
    return response

@app.get("/health")
def health_check():
    return {"status": "ok", "app": settings.APP_NAME}

app.include_router(auth_router)

async def daily_flag_job():
    while True:
        # Sleep until next midnight
        now = datetime.now()
        tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        await asyncio.sleep((tomorrow - now).total_seconds())
        
        from app.db.session import SessionLocal
        from app.employees.service import flag_overdue_employees
        db = SessionLocal()
        try:
            count = flag_overdue_employees(db)
            logger.info(f"Flagged {count} overdue pending employees")
        except Exception as e:
            logger.error(f"daily_flag_job error: {e}")
        finally:
            db.close()

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
    asyncio.create_task(daily_flag_job())   # ADD THIS LINE
    yield
    logger.info(f"{settings.APP_NAME} shutting down...")