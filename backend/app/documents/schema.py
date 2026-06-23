from pydantic import BaseModel
from datetime import datetime
import uuid

DOCUMENT_CATEGORIES = [
    "ID Proof",
    "Qualification Certificate",
    "Experience Letter",
    "Offer Letter",
    "Medical Certificate",
    "Other",
]

class DocumentResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    category: str
    label: str
    filename: str
    mime_type: str
    size_bytes: int
    uploaded_by: str
    uploaded_at: datetime

    model_config = {"from_attributes": True}

class DocumentListResponse(BaseModel):
    total: int
    items: list[DocumentResponse]