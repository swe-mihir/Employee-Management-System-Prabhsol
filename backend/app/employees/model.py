import uuid
from sqlalchemy import Column, String, Date, Boolean, UUID
from app.db.base import Base

class Employee(Base):
    __tablename__ = "employees"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name             = Column(String(255), nullable=False)
    date_of_birth    = Column(Date)
    department       = Column(String(100))
    designation      = Column(String(100))
    join_date        = Column(Date, nullable=False)
    leaving_date     = Column(Date)
    is_active        = Column(Boolean, nullable=False, default=True)
    personal_phone   = Column(String(20))
    work_phone       = Column(String(20))
    personal_email   = Column(String(255))
    work_email       = Column(String(255))
    aadhar_no        = Column(String(12), unique=True)
    pan_no           = Column(String(10), unique=True)
    pf_no            = Column(String(12))
    ip_no            = Column(String(12))
    status         = Column(String(20), nullable=False, default="active")
    approve_before = Column(Date)