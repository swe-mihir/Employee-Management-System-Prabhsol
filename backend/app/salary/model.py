import uuid
from sqlalchemy import Column, String, Date, Numeric, ForeignKey, Index, UUID
from app.db.base import Base

class EmployeeSalaryStructure(Base):
    __tablename__ = "employee_salary_structure"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id         = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False)
    basic_allowance     = Column(Numeric(12, 2), nullable=False, default=0)
    hra_allowance       = Column(Numeric(12, 2), nullable=False, default=0)
    conveyance_allowance = Column(Numeric(12, 2), nullable=False, default=0)
    medical_allowance   = Column(Numeric(12, 2), nullable=False, default=0)
    effective_from      = Column(Date, nullable=False)
    effective_to        = Column(Date)
    account_name        = Column(String(255))
    account_number      = Column(String(50))
    bank_ifsc_code      = Column(String(20))
    bank_name           = Column(String(255))
    bank_branch         = Column(String(255))

    __table_args__ = (
        Index("idx_emp_salary_structure_emp", "employee_id"),
    )