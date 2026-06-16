from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid
from decimal import Decimal

class PayrollItem(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str
    designation: Optional[str] = None
    month: int
    year: int
    days_present: int
    days_absent: int
    leaves_taken: int
    gross_salary: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    total_ctc: Decimal
    status: str
    calculated_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    model_config = {"from_attributes": True}

class PayrollListResponse(BaseModel):
    total: int
    items: list[PayrollItem]