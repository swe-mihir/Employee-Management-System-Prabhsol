import uuid
from sqlalchemy import Column, String, BigInteger, ForeignKey, TIMESTAMP, UUID
from sqlalchemy.sql import func
from app.db.base import Base

class EmployeeDocument(Base):
    __tablename__ = "employee_documents"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    category    = Column(String(100), nullable=False)
    label       = Column(String(255), nullable=False)
    filename    = Column(String(255), nullable=False)   # original filename
    stored_name = Column(String(255), nullable=False)   # uuid-based name on disk
    mime_type   = Column(String(100), nullable=False)
    size_bytes  = Column(BigInteger, nullable=False)
    uploaded_by = Column(String(255), nullable=False)   # email of uploader
    uploaded_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())