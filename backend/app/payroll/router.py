from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, List
import uuid
from app.core.security import TokenData
from app.payroll.schema import PayrollCreate, PayrollUpdate, PayrollResponse, PayrollListResponse
from app.payroll import service as payroll_service
from app.auth.deps import get_current_user, get_audited_session, require_role
from app.db.deps import get_db

router = APIRouter(prefix="/payroll", tags=["Payroll"])

@router.get("/me", response_model=PayrollListResponse)
def list_my_payroll(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None),
    sort_by: str = Query("year"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: TokenData = Depends(get_current_user),
   db: Session = Depends(get_db),
):
    if not current_user.employee_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No employee record linked to this user")
    return payroll_service.list_my_payroll(
        db, current_user.employee_id, month, year, sort_by, sort_dir, page, page_size
    )


@router.get("", response_model=PayrollListResponse)
def list_payroll(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None),
    status: str = Query("all"),
    employee_ids: Optional[List[str]] = Query(None),
    historical: bool = Query(False),
    sort_by: str = Query("year"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _=Depends(require_role("admin", "manager")),
    db: Session = Depends(get_db),
):
    return payroll_service.list_payroll(
        db, month, year, status, employee_ids,
        historical, sort_by, sort_dir, page, page_size
    )


@router.post("", response_model=PayrollResponse, status_code=status.HTTP_201_CREATED)
def create_payroll(
    payload: PayrollCreate,
    db: Session = Depends(get_audited_session),
    _=Depends(require_role("admin", "manager")),
):
    try:
        return payroll_service.create_payroll(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{record_id}", response_model=PayrollResponse)
def update_payroll(
    record_id: uuid.UUID,
    payload: PayrollUpdate,
    db: Session = Depends(get_audited_session),
    _=Depends(require_role("admin", "manager")),
):
    try:
        return payroll_service.update_payroll(db, record_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{record_id}/calculate", response_model=PayrollResponse)
def calculate_payroll(
    record_id: uuid.UUID,
    db: Session = Depends(get_audited_session),
    _=Depends(require_role("admin", "manager")),
):
    try:
        return payroll_service.calculate_payroll(db, record_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{record_id}/mark-paid", response_model=PayrollResponse)
def mark_paid(
    record_id: uuid.UUID,
    db: Session = Depends(get_audited_session),
    _=Depends(require_role("admin", "manager")),
):
    try:
        return payroll_service.mark_paid(db, record_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))