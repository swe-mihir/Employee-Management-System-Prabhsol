from sqlalchemy.orm import Session
from sqlalchemy import select
import uuid
from app.salary import repository
from app.salary.schema import SalaryStructureCreate, SalaryStructureUpdate, SalaryStructureResponse, SalaryStructureListResponse
from app.employees.model import Employee


def _enrich(struct, employee_name: str) -> SalaryStructureResponse:
    data = SalaryStructureResponse.model_validate(struct)
    data.employee_name = employee_name
    return data


def list_structures(db: Session) -> SalaryStructureListResponse:
    rows = repository.get_all(db)
    items = [_enrich(s, name) for s, name in rows]
    return SalaryStructureListResponse(total=len(items), items=items)


def get_structure(db: Session, employee_id: uuid.UUID) -> SalaryStructureResponse:
    struct = repository.get_by_employee(db, employee_id)
    if not struct:
        raise ValueError("Salary structure not found")
    emp = db.execute(select(Employee).where(Employee.id == employee_id)).scalar_one_or_none()
    return _enrich(struct, emp.name if emp else "")


def create_structure(db: Session, payload: SalaryStructureCreate) -> SalaryStructureResponse:
    emp = db.execute(select(Employee).where(Employee.id == payload.employee_id)).scalar_one_or_none()
    if not emp:
        raise ValueError("Employee not found")
    data = payload.model_dump()
    struct = repository.create(db, data)
    db.commit()
    db.refresh(struct)
    return _enrich(struct, emp.name)


def update_structure(db: Session, structure_id: uuid.UUID, payload: SalaryStructureUpdate) -> SalaryStructureResponse:
    struct = repository.get_by_id(db, structure_id)
    if not struct:
        raise ValueError("Salary structure not found")
    data = payload.model_dump(exclude_unset=True)
    struct = repository.update(db, struct, data)
    db.commit()
    db.refresh(struct)
    emp = db.execute(select(Employee).where(Employee.id == struct.employee_id)).scalar_one_or_none()
    return _enrich(struct, emp.name if emp else "")

def list_structures_for_employee(db: Session, employee_id: str) -> SalaryStructureListResponse:
    emp_uuid = uuid.UUID(employee_id)
    emp = db.execute(select(Employee).where(Employee.id == emp_uuid)).scalar_one_or_none()
    rows = repository.get_all_by_employee(db, emp_uuid)
    items = [_enrich(s, emp.name if emp else "") for s in rows]
    return SalaryStructureListResponse(total=len(items), items=items)