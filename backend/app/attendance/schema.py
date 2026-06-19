from pydantic import BaseModel
from typing import Optional
from datetime import date, time
import uuid


class AttendanceDailyItem(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    emp_code: Optional[str] = None
    name: str
    status: Optional[str] = None
    clock_in: Optional[time] = None
    clock_out: Optional[time] = None
    required_hours: Optional[float] = None
    hours_worked: Optional[float] = None

    model_config = {"from_attributes": True}


class AttendanceDailyResponse(BaseModel):
    date: date
    total: int
    items: list[AttendanceDailyItem]


class AttendanceMonthItem(BaseModel):
    employee_id: uuid.UUID
    emp_code: Optional[str] = None
    name: str
    days: dict[int, Optional[str]]
    total_paid: int


class AttendanceMonthResponse(BaseModel):
    year: int
    month: int
    days_in_month: int
    total: int
    items: list[AttendanceMonthItem]

class AttendanceMarkItem(BaseModel):
    employee_id: uuid.UUID
    date: date
    status: str
    clock_in: Optional[time] = None
    clock_out: Optional[time] = None
    hours_worked: Optional[float] = None

class AttendanceMarkRequest(BaseModel):
    records: list[AttendanceMarkItem]

class AttendanceMarkResponse(BaseModel):
    saved: int
    errors: list[str]