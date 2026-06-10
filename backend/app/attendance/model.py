import uuid
from sqlalchemy import Column, Date, Time, Float, String, ForeignKey, UniqueConstraint, Index, UUID
from app.db.base import Base

class Attendance(Base):
    __tablename__ = "attendance"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id  = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False)
    date         = Column(Date, nullable=False)
    status       = Column(String(50), nullable=False)
    clock_in     = Column(Time)
    clock_out    = Column(Time)
    hours_worked = Column(Float)

    __table_args__ = (
        UniqueConstraint("employee_id", "date", name="attendance_employee_id_date_key"),
        Index("idx_attendance_employee_date", "employee_id", "date"),
    )