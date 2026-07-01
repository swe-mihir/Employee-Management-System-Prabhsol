from sqlalchemy.orm import Session
from sqlalchemy import select, and_, asc, desc
from typing import Optional, List
from datetime import date
import uuid
from app.payroll.model import SalaryHistory
from app.employees.model import Employee


def get_list(
    db: Session,
    month: Optional[int],
    year: Optional[int],
    status_filter: str,
    employee_ids: Optional[List[str]],
    historical: bool,
    sort_by: str,
    sort_dir: str,
    skip: int,
    limit: int,
):
    q = db.query(SalaryHistory)

    if historical:
        if year:
            q = q.filter(SalaryHistory.year == year)
        if month:
            q = q.filter(SalaryHistory.month == month)
    else:
        if month:
            q = q.filter(SalaryHistory.month == month)
        if year:
            q = q.filter(SalaryHistory.year == year)

    if status_filter != "all":
        q = q.filter(SalaryHistory.status == status_filter)

    if employee_ids:
        q = q.filter(SalaryHistory.employee_id.in_(employee_ids))

    sortable = {
        "month": SalaryHistory.month,
        "year": SalaryHistory.year,
        "net_salary": SalaryHistory.net_salary,
        "status": SalaryHistory.status,
    }
    sort_col = sortable.get(sort_by, SalaryHistory.year)
    q = q.order_by(asc(sort_col) if sort_dir == "asc" else desc(sort_col), SalaryHistory.month.desc())

    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return total, items


def get_by_id(db: Session, record_id: uuid.UUID) -> Optional[SalaryHistory]:
    return db.execute(
        select(SalaryHistory).where(SalaryHistory.id == record_id)
    ).scalar_one_or_none()


def exists_for_employee_month(db: Session, employee_id: uuid.UUID, month: int, year: int) -> bool:
    result = db.execute(
        select(SalaryHistory.id).where(
            SalaryHistory.employee_id == employee_id,
            SalaryHistory.month == month,
            SalaryHistory.year == year,
        )
    ).scalar_one_or_none()
    return result is not None


def create(db: Session, data: dict) -> SalaryHistory:
    obj = SalaryHistory(**data)
    db.add(obj)
    db.flush()
    return obj


def update(db: Session, obj: SalaryHistory, data: dict) -> SalaryHistory:
    for k, v in data.items():
        setattr(obj, k, v)
    db.flush()
    return obj

def get_calculated_for_month(db: Session, month: int, year: int):
    return db.execute(
        select(SalaryHistory, Employee.name)
        .join(Employee, Employee.id == SalaryHistory.employee_id)
        .where(
            SalaryHistory.month == month,
            SalaryHistory.year == year,
            SalaryHistory.status == "calculated",
        )
    ).all()