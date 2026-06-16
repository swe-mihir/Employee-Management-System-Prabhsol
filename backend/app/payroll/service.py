from sqlalchemy.orm import Session
from typing import Optional
from app.payroll import repository
from app.payroll.schema import PayrollItem, PayrollListResponse

def list_payroll(
    db: Session,
    month: Optional[int],
    year: int,
    status: str,
    employee_ids: list[str],
    sort_by: str,
    sort_dir: str,
    page: int,
    page_size: int,
) -> PayrollListResponse:
    skip = (page - 1) * page_size
    total, rows = repository.get_payroll(db, month, year, status, employee_ids, sort_by, sort_dir, skip, page_size)
    items = []
    for rec, emp_name, designation in rows:
        items.append(PayrollItem(
            id=rec.id,
            employee_id=rec.employee_id,
            employee_name=emp_name,
            designation=designation,
            month=rec.month,
            year=rec.year,
            days_present=rec.days_present,
            days_absent=rec.days_absent,
            leaves_taken=rec.leaves_taken,
            gross_salary=rec.gross_salary,
            total_deductions=rec.total_deductions,
            net_salary=rec.net_salary,
            total_ctc=rec.total_ctc,
            status=rec.status,
            calculated_at=rec.calculated_at,
            paid_at=rec.paid_at,
        ))
    return PayrollListResponse(total=total, items=items)

def mark_paid(db: Session, record_id: str) -> PayrollItem:
    rec = repository.mark_paid(db, record_id)
    if not rec:
        raise ValueError("Record not found")
    from sqlalchemy import select
    from app.employees.model import Employee
    emp = db.query(Employee).filter(Employee.id == rec.employee_id).first()
    db.commit()
    db.refresh(rec)
    return PayrollItem(
        id=rec.id,
        employee_id=rec.employee_id,
        employee_name=emp.name if emp else "",
        designation=emp.designation if emp else None,
        month=rec.month,
        year=rec.year,
        days_present=rec.days_present,
        days_absent=rec.days_absent,
        leaves_taken=rec.leaves_taken,
        gross_salary=rec.gross_salary,
        total_deductions=rec.total_deductions,
        net_salary=rec.net_salary,
        total_ctc=rec.total_ctc,
        status=rec.status,
        calculated_at=rec.calculated_at,
        paid_at=rec.paid_at,
    )