from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import Optional
from datetime import date
import uuid
from app.salary.model import EmployeeSalaryStructure
from app.employees.model import Employee


def get_all(db: Session):
    rows = db.execute(
        select(EmployeeSalaryStructure, Employee.name)
        .join(Employee, Employee.id == EmployeeSalaryStructure.employee_id)
        .order_by(Employee.name)
    ).all()
    return rows

def get_all_by_employee(db: Session, employee_id: uuid.UUID):
    return db.execute(
        select(EmployeeSalaryStructure)
        .where(EmployeeSalaryStructure.employee_id == employee_id)
        .order_by(EmployeeSalaryStructure.effective_from.desc())
    ).scalars().all()


def get_by_employee(db: Session, employee_id: uuid.UUID) -> Optional[EmployeeSalaryStructure]:
    return db.execute(
        select(EmployeeSalaryStructure)
        .where(EmployeeSalaryStructure.employee_id == employee_id)
        .order_by(EmployeeSalaryStructure.effective_from.desc())
    ).scalar_one_or_none()


def get_by_id(db: Session, structure_id: uuid.UUID) -> Optional[EmployeeSalaryStructure]:
    return db.execute(
        select(EmployeeSalaryStructure).where(EmployeeSalaryStructure.id == structure_id)
    ).scalar_one_or_none()


def get_effective_for_month(db: Session, employee_id: uuid.UUID, month_start: date, month_end: date) -> Optional[EmployeeSalaryStructure]:
    return db.execute(
        select(EmployeeSalaryStructure)
        .where(
            EmployeeSalaryStructure.employee_id == employee_id,
            EmployeeSalaryStructure.effective_from <= month_start,
            (EmployeeSalaryStructure.effective_to == None) | (EmployeeSalaryStructure.effective_to >= month_end),
        )
        .order_by(EmployeeSalaryStructure.effective_from.desc())
    ).scalar_one_or_none()


def create(db: Session, data: dict) -> EmployeeSalaryStructure:
    obj = EmployeeSalaryStructure(**data)
    db.add(obj)
    db.flush()
    return obj


def update(db: Session, obj: EmployeeSalaryStructure, data: dict) -> EmployeeSalaryStructure:
    for k, v in data.items():
        setattr(obj, k, v)
    db.flush()
    return obj