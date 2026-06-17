import uuid
from sqlalchemy import Column, String, SmallInteger, Numeric, Text, ForeignKey, UniqueConstraint, Index, UUID, TIMESTAMP
from app.db.base import Base

class SalaryHistory(Base):
    __tablename__ = "salary_history"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id      = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False)
    month            = Column(SmallInteger, nullable=False)
    year             = Column(SmallInteger, nullable=False)
    days_present     = Column(SmallInteger, nullable=False, default=0)
    days_absent      = Column(SmallInteger, nullable=False, default=0)
    leaves_taken     = Column(SmallInteger, nullable=False, default=0)

    # Variable inputs
    ot_hours         = Column(Numeric(8, 2), nullable=False, default=0)
    advance          = Column(Numeric(12, 2), nullable=False, default=0)
    loan             = Column(Numeric(12, 2), nullable=False, default=0)
    tds              = Column(Numeric(12, 2), nullable=False, default=0)
    employee_mlwf    = Column(Numeric(12, 2), nullable=False, default=0)
    employer_mlwf    = Column(Numeric(12, 2), nullable=False, default=0)
    incentive        = Column(Numeric(12, 2), nullable=False, default=0)

    # Computed columns
    ern_basic        = Column(Numeric(12, 2))
    ern_hra          = Column(Numeric(12, 2))
    ern_conveyance   = Column(Numeric(12, 2))
    ern_medical      = Column(Numeric(12, 2))
    ot_amount        = Column(Numeric(12, 2))
    gross_salary     = Column(Numeric(12, 2))
    emp_pf           = Column(Numeric(12, 2))
    emp_esic         = Column(Numeric(12, 2))
    pt               = Column(Numeric(12, 2))
    total_deductions = Column(Numeric(12, 2))
    net_salary       = Column(Numeric(12, 2))
    employer_pf      = Column(Numeric(12, 2))
    employer_admin   = Column(Numeric(12, 2))
    employer_total_pf = Column(Numeric(12, 2))
    emp_employer_pf  = Column(Numeric(12, 2))
    employer_esic    = Column(Numeric(12, 2))
    emp_employer_esic = Column(Numeric(12, 2))
    emp_employer_mlwf = Column(Numeric(12, 2))
    total_ctc        = Column(Numeric(12, 2))

    status           = Column(String(30), nullable=False, default="pending")
    calculated_at    = Column(TIMESTAMP(timezone=True))
    paid_at          = Column(TIMESTAMP(timezone=True))

    __table_args__ = (
        UniqueConstraint("employee_id", "month", "year", name="salary_history_employee_id_month_year_key"),
        Index("idx_salary_history_employee", "employee_id"),
    )


class SalaryComponent(Base):
    __tablename__ = "salary_components"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    salary_history_id = Column(UUID(as_uuid=True), ForeignKey("salary_history.id", ondelete="RESTRICT"), nullable=False)
    component_name    = Column(String(100), nullable=False)
    component_type    = Column(String(30), nullable=False)
    amount            = Column(Numeric(12, 2), nullable=False)
    note              = Column(Text)

    __table_args__ = (
        Index("idx_salary_components_history", "salary_history_id"),
    )