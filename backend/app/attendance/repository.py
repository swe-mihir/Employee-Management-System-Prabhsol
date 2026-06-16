from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from datetime import date
import calendar
from typing import Optional
from app.attendance.model import Attendance
from app.employees.model import Employee


PAID_STATUSES = {"P", "PL", "SL"}


def get_daily_attendance(db: Session, target_date: date, employee_id: Optional[str] = None):
     rows = db.execute(
         select(
             Attendance,
             Employee.name,
             Employee.emp_code,
             Employee.required_hours,
         )
         .join(Employee, Employee.id == Attendance.employee_id)
        .where(
            and_(
                Attendance.date == target_date,
                *([Attendance.employee_id == employee_id] if employee_id else [])
            )
        )
         .order_by(Employee.name)
     ).all()
     return rows




def get_monthly_attendance(db: Session, year: int, month: int, employee_id: Optional[str] = None):
    first = date(year, month, 1)
    last = date(year, month, calendar.monthrange(year, month)[1])

    filters = [Attendance.date >= first, Attendance.date <= last]
    if employee_id:
        filters.append(Attendance.employee_id == employee_id)

    rows = db.execute(
         select(
             Attendance.employee_id,
             Attendance.date,
             Attendance.status,
             Employee.name,
             Employee.emp_code,
         )
         .join(Employee, Employee.id == Attendance.employee_id)
        .where(and_(*filters))
         .order_by(Employee.name, Attendance.date)
     ).all()
    return rows