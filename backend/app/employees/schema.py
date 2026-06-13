from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date
import uuid


# ── Create ─────────────────────────────────────────────────────────────────

class EmployeeCreate(BaseModel):
    name: str
    date_of_birth: Optional[date] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    join_date: date
    personal_phone: Optional[str] = None
    work_phone: Optional[str] = None
    personal_email: Optional[str] = None
    work_email: Optional[str] = None
    aadhar_no: Optional[str] = None
    pan_no: Optional[str] = None
    pf_no: Optional[str] = None
    ip_no: Optional[str] = None
    status: Optional[str] = "active"
    approve_before: Optional[date] = None


# ── Update (all fields optional) ───────────────────────────────────────────

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    date_of_birth: Optional[date] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    join_date: Optional[date] = None
    leaving_date: Optional[date] = None
    is_active: Optional[bool] = None
    personal_phone: Optional[str] = None
    work_phone: Optional[str] = None
    personal_email: Optional[str] = None
    work_email: Optional[str] = None
    aadhar_no: Optional[str] = None
    pan_no: Optional[str] = None
    pf_no: Optional[str] = None
    ip_no: Optional[str] = None
    status: Optional[str] = None
    approve_before: Optional[date] = None


# ── Response ───────────────────────────────────────────────────────────────

class EmployeeResponse(BaseModel):
    id: uuid.UUID
    name: str
    date_of_birth: Optional[date] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    join_date: date
    leaving_date: Optional[date] = None
    is_active: bool
    personal_phone: Optional[str] = None
    work_phone: Optional[str] = None
    personal_email: Optional[str] = None
    work_email: Optional[str] = None
    aadhar_no: Optional[str] = None
    pan_no: Optional[str] = None
    pf_no: Optional[str] = None
    ip_no: Optional[str] = None

    model_config = {"from_attributes": True}
    status: str
    approve_before: Optional[date] = None


# ── List item (lighter, for table rows) ───────────────────────────────────

class EmployeeListItem(BaseModel):
    id: uuid.UUID
    name: str
    department: Optional[str] = None
    designation: Optional[str] = None
    join_date: date
    leaving_date: Optional[date] = None
    is_active: bool
    personal_phone: Optional[str] = None
    work_phone: Optional[str] = None
    personal_email: Optional[str] = None
    work_email: Optional[str] = None
    date_of_birth: Optional[date] = None
    aadhar_no: Optional[str] = None
    pan_no: Optional[str] = None
    pf_no: Optional[str] = None
    ip_no: Optional[str] = None

    model_config = {"from_attributes": True}
    status: str
    approve_before: Optional[date] = None


class EmployeeListResponse(BaseModel):
    total: int
    items: list[EmployeeListItem]