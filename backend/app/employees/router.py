from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.employees.schema import EmployeeCreate, EmployeeUpdate, EmployeeResponse, EmployeeListResponse
from app.employees import service as employee_service
from app.auth.deps import get_current_user, get_audited_session
from app.core.security import TokenData
from app.db.deps import get_db

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get("", response_model=EmployeeListResponse)
def list_employees(
    status: str = Query("current", pattern="^(current|left|all|pending)$"),
    sort_by: str = Query("name"),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return employee_service.list_employees(db, status, sort_by, sort_dir, page, page_size)


@router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(
    employee_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return employee_service.get_employee(db, employee_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
def create_employee(
    payload: EmployeeCreate,
    db: Session = Depends(get_audited_session),
):
    return employee_service.create_employee(db, payload)


@router.put("/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: str,
    payload: EmployeeUpdate,
    db: Session = Depends(get_audited_session),
):
    try:
        return employee_service.update_employee(db, employee_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    
@router.post("/{employee_id}/approve", response_model=EmployeeResponse)
def approve_employee(
    employee_id: str,
    db: Session = Depends(get_audited_session),
):
    try:
        return employee_service.approve_employee(db, employee_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))