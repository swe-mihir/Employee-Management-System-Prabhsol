from sqlalchemy.orm import Session
from sqlalchemy import asc, desc
from typing import Optional
from app.employees.model import Employee


# ── List ───────────────────────────────────────────────────────────────────

def get_employees(
    db: Session,
    status: str = "current",       # "current" | "left" | "all"
    sort_by: str = "name",
    sort_dir: str = "asc",
    skip: int = 0,
    limit: int = 50,
) -> tuple[int, list[Employee]]:

    q = db.query(Employee)

    if status == "current":
        q = q.filter(Employee.is_active == True)
    elif status == "left":
        q = q.filter(Employee.is_active == False)
    # "all" — no filter

    # Sorting — only allow known columns to prevent injection
    sortable = {
        "name": Employee.name,
        "designation": Employee.designation,
        "department": Employee.department,
        "join_date": Employee.join_date,
        "leaving_date": Employee.leaving_date,
    }
    sort_col = sortable.get(sort_by, Employee.name)
    q = q.order_by(asc(sort_col) if sort_dir == "asc" else desc(sort_col))

    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return total, items


# ── Single ─────────────────────────────────────────────────────────────────

def get_employee_by_id(db: Session, employee_id: str) -> Optional[Employee]:
    return db.query(Employee).filter(Employee.id == employee_id).first()


# ── Create ─────────────────────────────────────────────────────────────────

def create_employee(db: Session, data: dict) -> Employee:
    employee = Employee(**data)
    db.add(employee)
    db.flush()   # get the generated UUID back before commit
    return employee


# ── Update ─────────────────────────────────────────────────────────────────

def update_employee(db: Session, employee: Employee, data: dict) -> Employee:
    for key, value in data.items():
        setattr(employee, key, value)
    db.flush()
    return employee