# backend/app/salary/router/py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import uuid
from app.salary.schema import SalaryStructureCreate, SalaryStructureUpdate, SalaryStructureResponse, SalaryStructureListResponse
from app.salary import service as salary_service
from app.auth.deps import get_current_user, get_audited_session, require_role
from app.core.security import TokenData
from app.db.deps import get_db

router = APIRouter(prefix="/salary-structure", tags=["Salary Structure"])


@router.get("", response_model=SalaryStructureListResponse)
def list_structures(
    current_user: TokenData = Depends(require_role("admin", "manager")),
    db: Session = Depends(get_db),
):
    return salary_service.list_structures(db)

@router.get("/me", response_model=SalaryStructureListResponse)
def get_my_structure(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.employee_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No employee record linked to this user")
    return salary_service.list_structures_for_employee(db, current_user.employee_id)

@router.get("/{employee_id}", response_model=SalaryStructureResponse)
def get_structure(
    employee_id: uuid.UUID,
    _=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return salary_service.get_structure(db, employee_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("", response_model=SalaryStructureResponse, status_code=status.HTTP_201_CREATED)
def create_structure(
    payload: SalaryStructureCreate,
    db: Session = Depends(get_audited_session),
    _: TokenData = Depends(require_role("admin", "manager")),
):
    try:
        return salary_service.create_structure(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{structure_id}", response_model=SalaryStructureResponse)
def update_structure(
    structure_id: uuid.UUID,
    payload: SalaryStructureUpdate,
    db: Session = Depends(get_audited_session),
    _: TokenData = Depends(require_role("admin", "manager")),
):
    try:
        return salary_service.update_structure(db, structure_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    
