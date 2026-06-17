from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid
from decimal import Decimal


class PayrollCreate(BaseModel):
    employee_id: uuid.UUID
    month: int
    year: int
    ot_hours: Decimal = Decimal("0")
    advance: Decimal = Decimal("0")
    loan: Decimal = Decimal("0")
    tds: Decimal = Decimal("0")
    employee_mlwf: Decimal = Decimal("0")
    employer_mlwf: Decimal = Decimal("0")
    incentive: Decimal = Decimal("0")


class PayrollUpdate(BaseModel):
    ot_hours: Optional[Decimal] = None
    advance: Optional[Decimal] = None
    loan: Optional[Decimal] = None
    tds: Optional[Decimal] = None
    employee_mlwf: Optional[Decimal] = None
    employer_mlwf: Optional[Decimal] = None
    incentive: Optional[Decimal] = None


class PayrollResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str = ""
    designation: str = ""
    month: int
    year: int
    days_present: int
    days_absent: int
    leaves_taken: int
    ot_hours: Decimal
    advance: Decimal
    loan: Decimal
    tds: Decimal
    employee_mlwf: Decimal
    employer_mlwf: Decimal
    incentive: Decimal
    ern_basic: Optional[Decimal] = None
    ern_hra: Optional[Decimal] = None
    ern_conveyance: Optional[Decimal] = None
    ern_medical: Optional[Decimal] = None
    ot_amount: Optional[Decimal] = None
    gross_salary: Optional[Decimal] = None
    emp_pf: Optional[Decimal] = None
    emp_esic: Optional[Decimal] = None
    pt: Optional[Decimal] = None
    total_deductions: Optional[Decimal] = None
    net_salary: Optional[Decimal] = None
    employer_pf: Optional[Decimal] = None
    employer_admin: Optional[Decimal] = None
    employer_total_pf: Optional[Decimal] = None
    emp_employer_pf: Optional[Decimal] = None
    employer_esic: Optional[Decimal] = None
    emp_employer_esic: Optional[Decimal] = None
    emp_employer_mlwf: Optional[Decimal] = None
    total_ctc: Optional[Decimal] = None
    status: str
    calculated_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PayrollListResponse(BaseModel):
    total: int
    items: list[PayrollResponse]