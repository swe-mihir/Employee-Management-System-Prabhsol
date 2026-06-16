from sqlalchemy.orm import Session
from datetime import date
import calendar
from typing import Optional
from app.attendance import repository
from app.attendance.schema import (
    AttendanceDailyItem,
    AttendanceDailyResponse,
    AttendanceMonthItem,
    AttendanceMonthResponse,
)

PAID_STATUSES = {"P", "PL", "SL"}

STATUS_MAP = {
    "Present": "P",
    "Absent": "A",
    "Sick Leave": "SL",
    "Paid Leave": "PL",
    "Weekly Holiday": "WH",
}


def get_daily(db: Session, target_date: date, employee_id: Optional[str] = None) -> AttendanceDailyResponse:
    rows = repository.get_daily_attendance(db, target_date, employee_id)
    items = []

    for att, name, emp_code, required_hours in rows:
        items.append(
            AttendanceDailyItem(
                id=att.id,
                employee_id=att.employee_id,
                emp_code=emp_code,
                name=name,
                status=att.status,
                clock_in=att.clock_in,
                clock_out=att.clock_out,
                required_hours=float(required_hours) if required_hours else None,
                hours_worked=att.hours_worked,
            )
        )

    return AttendanceDailyResponse(
        date=target_date,
        total=len(items),
        items=items,
    )


def get_monthly(db: Session, year: int, month: int, employee_id: Optional[str] = None) -> AttendanceMonthResponse:
    rows = repository.get_monthly_attendance(db, year, month, employee_id)
    days_in_month = calendar.monthrange(year, month)[1]

    emp_map: dict[str, AttendanceMonthItem] = {}

    for row in rows:
        key = str(row.employee_id)

        if key not in emp_map:
            emp_map[key] = AttendanceMonthItem(
                employee_id=row.employee_id,
                emp_code=row.emp_code,
                name=row.name,
                days={},
                total_paid=0,
            )

        day_num = row.date.day

        status_code = STATUS_MAP.get(row.status, row.status)

        emp_map[key].days[day_num] = status_code

        if status_code in PAID_STATUSES:
            emp_map[key].total_paid += 1

    return AttendanceMonthResponse(
        year=year,
        month=month,
        days_in_month=days_in_month,
        total=len(emp_map),
        items=list(emp_map.values()),
    )