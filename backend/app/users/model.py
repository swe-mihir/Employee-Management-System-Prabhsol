from sqlalchemy import Column, Integer, String, Boolean, Text, ForeignKey, Index, UUID, TIMESTAMP
from sqlalchemy.sql import func
from app.db.base import Base

class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    employee_id   = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="RESTRICT"), unique=True)
    email         = Column(String(255), nullable=False, unique=True)
    password_hash = Column(Text, nullable=False)
    is_active     = Column(Boolean, nullable=False, default=True)
    created_at    = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index("idx_users_employee", "employee_id"),
    )