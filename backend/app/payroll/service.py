from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from typing import Optional, List
from datetime import date, datetime, timezone
from decimal import Decimal
import calendar
import uuid

from app.payroll import repository
from app.payroll.model import SalaryHistory, SalaryComponent
from app.payroll.schema import PayrollCreate, PayrollUpdate, PayrollResponse, PayrollListResponse
from app.employees.model import Employee
from app.salary.repository import get_effective_for_month
from app.attendance.model import Attendance


def _enrich(db: Session, record: SalaryHistory) -> PayrollResponse:
    emp = db.execute(select(Employee).where(Employee.id == record.employee_id)).scalar_one_or_none()
    data = PayrollResponse.model_validate(record)
    if emp:
        data.employee_name = emp.name
        data.designation = emp.designation or ""
    return data


def list_payroll(
    db: Session,
    month: Optional[int],
    year: Optional[int],
    status_filter: str,
    employee_ids: Optional[List[str]],
    historical: bool,
    sort_by: str,
    sort_dir: str,
    page: int,
    page_size: int,
) -> PayrollListResponse:
    skip = (page - 1) * page_size
    total, items = repository.get_list(
        db, month, year, status_filter, employee_ids,
        historical, sort_by, sort_dir, skip, page_size
    )
    return PayrollListResponse(total=total, items=[_enrich(db, r) for r in items])

def list_my_payroll(
    db: Session,
    employee_id: str,
    month: Optional[int],
    year: Optional[int],
    sort_by: str,
    sort_dir: str,
    page: int,
    page_size: int,
) -> PayrollListResponse:
    skip = (page - 1) * page_size
    total, items = repository.get_list(
        db, month, year, "all", [employee_id],
        True, sort_by, sort_dir, skip, page_size
    )
    return PayrollListResponse(total=total, items=[_enrich(db, r) for r in items])



def create_payroll(db: Session, payload: PayrollCreate) -> PayrollResponse:
    emp = db.execute(select(Employee).where(Employee.id == payload.employee_id)).scalar_one_or_none()
    if not emp:
        raise ValueError("Employee not found")
    if repository.exists_for_employee_month(db, payload.employee_id, payload.month, payload.year):
        raise ValueError("Payroll record already exists for this employee and month")
    data = payload.model_dump()
    data["status"] = "pending"
    record = repository.create(db, data)
    db.commit()
    db.refresh(record)
    return _enrich(db, record)


def update_payroll(db: Session, record_id: uuid.UUID, payload: PayrollUpdate) -> PayrollResponse:
    record = repository.get_by_id(db, record_id)
    if not record:
        raise ValueError("Record not found")
    if record.status not in ("pending", "calculated"):
        raise ValueError("Cannot edit a paid record")
    data = payload.model_dump(exclude_unset=True)
    repository.update(db, record, data)
    db.commit()
    db.refresh(record)
    return _enrich(db, record)


def calculate_payroll(db: Session, record_id: uuid.UUID) -> PayrollResponse:
    record = repository.get_by_id(db, record_id)
    if not record:
        raise ValueError("Record not found")

    days_in_month = calendar.monthrange(record.year, record.month)[1]
    month_start = date(record.year, record.month, 1)
    month_end = date(record.year, record.month, days_in_month)

    struct = get_effective_for_month(db, record.employee_id, month_start, month_end)
    if not struct:
        raise ValueError("No effective salary structure found for this employee and month")

    # Attendance counts
    att_rows = db.execute(
        select(Attendance.status).where(
            and_(
                Attendance.employee_id == record.employee_id,
                Attendance.date >= month_start,
                Attendance.date <= month_end,
            )
        )
    ).scalars().all()

    days_present = sum(1 for s in att_rows if s in ("P", "PL", "SL", "Present", "Paid Leave", "Sick Leave"))
    days_absent = sum(1 for s in att_rows if s in ("A", "Absent"))
    leaves_taken = sum(1 for s in att_rows if s in ("PL", "SL", "Paid Leave", "Sick Leave"))

    def d(v):
        return Decimal(str(v)) if v is not None else Decimal("0")

    basic = d(struct.basic_allowance)
    hra = d(struct.hra_allowance)
    conv = d(struct.conveyance_allowance)
    med = d(struct.medical_allowance)
    dp = Decimal(str(days_present))
    dim = Decimal(str(days_in_month))
    ot_h = d(record.ot_hours)
    incentive = d(record.incentive)
    adv = d(record.advance)
    loan = d(record.loan)
    tds = d(record.tds)
    emp_mlwf = d(record.employee_mlwf)
    er_mlwf = d(record.employer_mlwf)

    ern_basic = (basic / dim * dp).quantize(Decimal("0.01"))
    ern_hra = (hra / dim * dp).quantize(Decimal("0.01"))
    ern_conv = (conv / dim * dp).quantize(Decimal("0.01"))
    ern_med = (med / dim * dp).quantize(Decimal("0.01"))

    if days_present > 0:
        ot_amount = (ern_basic * ot_h / (Decimal("8") * dp)).quantize(Decimal("0.01"))
    else:
        ot_amount = Decimal("0")

    gross = (ern_basic + ern_hra + ern_conv + ern_med + ot_amount + incentive).quantize(Decimal("0.01"))

    emp_pf = (Decimal("0.12") * ern_basic).quantize(Decimal("0.01"))
    emp_esic = Decimal("0") if ern_basic > 25000 else (Decimal("0.0075") * ern_basic).quantize(Decimal("0.01"))
    pt = Decimal("300") if record.month == 3 else Decimal("200")

    total_deductions = (emp_pf + emp_esic + pt + emp_mlwf + adv + loan + tds).quantize(Decimal("0.01"))
    net_salary = (gross - total_deductions).quantize(Decimal("0.01"))

    employer_pf = (Decimal("0.12") * ern_basic).quantize(Decimal("0.01"))
    employer_admin = Decimal("0") if ern_basic > 25000 else min((Decimal("0.01") * ern_basic).quantize(Decimal("0.01")), Decimal("1800"))
    employer_total_pf = (employer_pf + employer_admin).quantize(Decimal("0.01"))
    emp_employer_pf = (emp_pf + employer_total_pf).quantize(Decimal("0.01"))
    employer_esic = Decimal("0") if gross > 21000 else (Decimal("0.0325") * gross).quantize(Decimal("0.01"))
    emp_employer_esic = (emp_esic + employer_esic).quantize(Decimal("0.01"))
    emp_employer_mlwf = (emp_mlwf + er_mlwf).quantize(Decimal("0.01"))
    total_ctc = (net_salary + emp_employer_pf + emp_employer_esic + emp_employer_mlwf).quantize(Decimal("0.01"))

    updates = {
        "days_present": days_present,
        "days_absent": days_absent,
        "leaves_taken": leaves_taken,
        "ern_basic": ern_basic,
        "ern_hra": ern_hra,
        "ern_conveyance": ern_conv,
        "ern_medical": ern_med,
        "ot_amount": ot_amount,
        "gross_salary": gross,
        "emp_pf": emp_pf,
        "emp_esic": emp_esic,
        "pt": pt,
        "total_deductions": total_deductions,
        "net_salary": net_salary,
        "employer_pf": employer_pf,
        "employer_admin": employer_admin,
        "employer_total_pf": employer_total_pf,
        "emp_employer_pf": emp_employer_pf,
        "employer_esic": employer_esic,
        "emp_employer_esic": emp_employer_esic,
        "emp_employer_mlwf": emp_employer_mlwf,
        "total_ctc": total_ctc,
        "status": "calculated",
        "calculated_at": datetime.now(timezone.utc),
    }
    repository.update(db, record, updates)

    # Write salary components
    db.query(SalaryComponent).filter(SalaryComponent.salary_history_id == record.id).delete()
    components = [
        ("Basic", "earning", ern_basic),
        ("HRA", "earning", ern_hra),
        ("Conveyance", "earning", ern_conv),
        ("Medical", "earning", ern_med),
        ("OT Amount", "earning", ot_amount),
        ("Incentive", "earning", incentive),
        ("Employee PF", "deduction", emp_pf),
        ("Employee ESIC", "deduction", emp_esic),
        ("PT", "deduction", pt),
        ("Advance", "deduction", adv),
        ("Loan", "deduction", loan),
        ("TDS", "deduction", tds),
        ("Employee MLWF", "deduction", emp_mlwf),
    ]
    for name, ctype, amount in components:
        db.add(SalaryComponent(
            salary_history_id=record.id,
            component_name=name,
            component_type=ctype,
            amount=amount,
        ))

    db.commit()
    db.refresh(record)
    return _enrich(db, record)


def mark_paid(db: Session, record_id: uuid.UUID) -> PayrollResponse:
    record = repository.get_by_id(db, record_id)
    if not record:
        raise ValueError("Record not found")
    repository.update(db, record, {"status": "paid", "paid_at": datetime.now(timezone.utc)})
    db.commit()
    db.refresh(record)
    return _enrich(db, record)