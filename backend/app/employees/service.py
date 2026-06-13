from sqlalchemy.orm import Session
from app.employees import repository
from app.employees.schema import EmployeeCreate, EmployeeListResponse, EmployeeResponse
from app.employees.model import Employee

def list_employees(
    db: Session,
    status: str,
    sort_by: str,
    sort_dir: str,
    page: int,
    page_size: int,
) -> EmployeeListResponse:
    skip = (page - 1) * page_size
    total, items = repository.get_employees(
        db,
        status=status,
        sort_by=sort_by,
        sort_dir=sort_dir,
        skip=skip,
        limit=page_size,
    )
    return EmployeeListResponse(total=total, items=items)


def get_employee(db: Session, employee_id: str) -> EmployeeResponse:
    emp = repository.get_employee_by_id(db, employee_id)
    if not emp:
        raise ValueError("Employee not found")
    return EmployeeResponse.model_validate(emp)


def create_employee(db: Session, payload: EmployeeCreate) -> EmployeeResponse:
    emp = repository.create_employee(db, payload.model_dump())
    db.commit()
    db.refresh(emp)
    return EmployeeResponse.model_validate(emp)


def update_employee(db: Session, employee_id: str, payload) -> EmployeeResponse:
    emp = repository.get_employee_by_id(db, employee_id)
    if not emp:
        raise ValueError("Employee not found")
    # Only update fields that were explicitly sent (exclude_unset)
    data = payload.model_dump(exclude_unset=True, exclude_none=False)
    # Convert empty strings to None for optional fields
    data = {k: (None if v == "" else v) for k, v in data.items()}
    emp = repository.update_employee(db, emp, data)
    db.commit()
    db.refresh(emp)
    return EmployeeResponse.model_validate(emp)

def flag_overdue_employees(db: Session) -> int:
    from sqlalchemy import update
    from datetime import date
    result = db.execute(
        update(Employee)
        .where(Employee.status == "pending", Employee.approve_before < date.today())
        .values(status="flagged")
    )
    db.commit()
    return result.rowcount

def approve_employee(db: Session, employee_id: str) -> EmployeeResponse:
    emp = repository.approve_employee(db, employee_id)
    if not emp:
        raise ValueError("Employee not found")
    db.commit()
    db.refresh(emp)
    return EmployeeResponse.model_validate(emp)