from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date

from app.attendance.schema import AttendanceDailyResponse, AttendanceMonthResponse
from app.attendance import service as attendance_service
from app.auth.deps import get_current_user
from app.core.security import TokenData
from app.db.deps import get_db

router = APIRouter(prefix="/attendance", tags=["Attendance"])


@router.get("/daily", response_model=AttendanceDailyResponse)
def get_daily(
    date: date = Query(default_factory=date.today),
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return attendance_service.get_daily(db, date)


@router.get("/monthly", response_model=AttendanceMonthResponse)
def get_monthly(
    year: int = Query(default_factory=lambda: date.today().year),
    month: int = Query(default_factory=lambda: date.today().month, ge=1, le=12),
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return attendance_service.get_monthly(db, year, month)