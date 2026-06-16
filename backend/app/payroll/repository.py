from sqlalchemy.orm import Session
from sqlalchemy import select, asc, desc, and_
from typing import Optional
from app.payroll.model import SalaryHistory
from app.employees.model import Employee

def get_payroll(
    db: Session,
    month: Optional[int],
    year: int,
    status: str,
    employee_ids: list[str],
    sort_by: str,
    sort_dir: str,
    skip: int,
    limit: int,
):
    q = (
        db.query(SalaryHistory, Employee.name, Employee.designation)
        .join(Employee, Employee.id == SalaryHistory.employee_id)
    )
    filters = [SalaryHistory.year == year]
    if month:
        filters.append(SalaryHistory.month == month)
    if status != "all":
        filters.append(SalaryHistory.status == status)
    if employee_ids:
        filters.append(SalaryHistory.employee_id.in_(employee_ids))
    q = q.where(and_(*filters))
    sortable = {
        "employee_name": Employee.name,
        "net_salary": SalaryHistory.net_salary,
        "gross_salary": SalaryHistory.gross_salary,
        "status": SalaryHistory.status,
        "month": SalaryHistory.month,
        "year": SalaryHistory.year,
    }
    sort_col = sortable.get(sort_by, Employee.name)
    q = q.order_by(asc(sort_col) if sort_dir == "asc" else desc(sort_col))
    total = q.count()
    rows = q.offset(skip).limit(limit).all()
    return total, rows

def mark_paid(db: Session, record_id: str):
    from datetime import datetime, timezone
    rec = db.query(SalaryHistory).filter(SalaryHistory.id == record_id).first()
    if not rec:
        return None
    rec.status = "paid"
    rec.paid_at = datetime.now(timezone.utc)
    db.flush()
    return rec