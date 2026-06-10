import uuid
from sqlalchemy import Column, String, Date, Numeric, ForeignKey, Index, UUID
from app.db.base import Base

class EmployeeSalaryStructure(Base):
    __tablename__ = "employee_salary_structure"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id         = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False)
    base_salary         = Column(Numeric(12, 2), nullable=False)
    hra                 = Column(Numeric(12, 2), nullable=False, default=0)
    transport_allowance = Column(Numeric(12, 2), nullable=False, default=0)
    other_allowances    = Column(Numeric(12, 2), nullable=False, default=0)
    pay_cycle           = Column(String(20), nullable=False, default="monthly")
    effective_from      = Column(Date, nullable=False)
    effective_to        = Column(Date)

    __table_args__ = (
        Index("idx_emp_salary_structure_emp", "employee_id"),
    )