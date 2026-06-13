from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from datetime import date
import calendar

from app.attendance.model import Attendance
from app.employees.model import Employee


PAID_STATUSES = {"P", "PL", "SL"}


def get_daily_attendance(db: Session, target_date: date):
    rows = db.execute(
        select(
            Attendance,
            Employee.name,
            Employee.emp_code,
            Employee.required_hours,
        )
        .join(Employee, Employee.id == Attendance.employee_id)
        .where(Attendance.date == target_date)
        .order_by(Employee.name)
    ).all()
    return rows


def get_monthly_attendance(db: Session, year: int, month: int):
    first = date(year, month, 1)
    last = date(year, month, calendar.monthrange(year, month)[1])

    rows = db.execute(
        select(
            Attendance.employee_id,
            Attendance.date,
            Attendance.status,
            Employee.name,
            Employee.emp_code,
        )
        .join(Employee, Employee.id == Attendance.employee_id)
        .where(and_(Attendance.date >= first, Attendance.date <= last))
        .order_by(Employee.name, Attendance.date)
    ).all()
    return rows