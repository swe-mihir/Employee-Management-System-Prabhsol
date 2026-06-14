from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class UserCreate(BaseModel):
    employee_id: uuid.UUID
    email: str
    password: str
    role: str  # admin | manager | employee


class UserUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    employee_id: Optional[uuid.UUID] = None
    employee_name: str = ""
    email: str
    role: str = ""
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    total: int
    items: list[UserResponse]