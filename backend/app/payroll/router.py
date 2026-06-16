from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from app.payroll.schema import PayrollListResponse, PayrollItem
from app.payroll import service as payroll_service
from app.auth.deps import get_current_user, require_role, get_audited_session
from app.core.security import TokenData
from app.db.deps import get_db

router = APIRouter(prefix="/payroll", tags=["Payroll"])

@router.get("", response_model=PayrollListResponse)
def list_payroll(
    year: int = Query(...),
    month: Optional[int] = Query(default=None),
    status: str = Query("all", pattern="^(pending|calculated|paid|all)$"),
    employee_id: List[str] = Query(default=[]),
    sort_by: str = Query("employee_name"),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: TokenData = Depends(require_role("admin", "manager")),
    db: Session = Depends(get_db),
):
    return payroll_service.list_payroll(db, month, year, status, employee_id, sort_by, sort_dir, page, page_size)

@router.post("/{record_id}/mark-paid", response_model=PayrollItem)
def mark_paid(
    record_id: str,
    db: Session = Depends(get_audited_session),
    current_user: TokenData = Depends(require_role("admin", "manager")),
):
    try:
        return payroll_service.mark_paid(db, record_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))