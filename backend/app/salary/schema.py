from pydantic import BaseModel
from typing import Optional
from datetime import date
import uuid
from decimal import Decimal


class SalaryStructureCreate(BaseModel):
    employee_id: uuid.UUID
    basic_allowance: Decimal
    hra_allowance: Decimal
    conveyance_allowance: Decimal
    medical_allowance: Decimal
    effective_from: date
    effective_to: Optional[date] = None
    account_name: Optional[str] = None
    account_number: Optional[str] = None
    bank_ifsc_code: Optional[str] = None
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None


class SalaryStructureUpdate(BaseModel):
    basic_allowance: Optional[Decimal] = None
    hra_allowance: Optional[Decimal] = None
    conveyance_allowance: Optional[Decimal] = None
    medical_allowance: Optional[Decimal] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    account_name: Optional[str] = None
    account_number: Optional[str] = None
    bank_ifsc_code: Optional[str] = None
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None


class SalaryStructureResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str = ""
    basic_allowance: Decimal
    hra_allowance: Decimal
    conveyance_allowance: Decimal
    medical_allowance: Decimal
    effective_from: date
    effective_to: Optional[date] = None
    account_name: Optional[str] = None
    account_number: Optional[str] = None
    bank_ifsc_code: Optional[str] = None
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None

    model_config = {"from_attributes": True}


class SalaryStructureListResponse(BaseModel):
    total: int
    items: list[SalaryStructureResponse]