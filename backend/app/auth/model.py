from sqlalchemy import Column, Integer, String, Text, ForeignKey, Index, PrimaryKeyConstraint, BigInteger, TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.sql import func
from app.db.base import Base

class Role(Base):
    __tablename__ = "roles"

    id        = Column(Integer, primary_key=True, autoincrement=True)
    role_name = Column(String(100), nullable=False, unique=True)


class Permission(Base):
    __tablename__ = "permissions"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    permission_name = Column(String(100), nullable=False, unique=True)
    description     = Column(Text)


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id     = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    role_id     = Column(Integer, ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False)
    assigned_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        PrimaryKeyConstraint("user_id", "role_id"),
    )


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id       = Column(Integer, ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False)
    permission_id = Column(Integer, ForeignKey("permissions.id", ondelete="RESTRICT"), nullable=False)

    __table_args__ = (
        PrimaryKeyConstraint("role_id", "permission_id"),
    )


class ActivityLog(Base):
    __tablename__ = "activity_log"

    id             = Column(BigInteger, primary_key=True, autoincrement=True)
    occurred_at    = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    performed_by   = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"))
    operation      = Column(String(10), nullable=False)
    table_name     = Column(String(100), nullable=False)
    record_id      = Column(Text, nullable=False)
    old_data       = Column(JSONB)
    new_data       = Column(JSONB)
    changed_fields = Column(ARRAY(Text))

    __table_args__ = (
        Index("idx_activity_log_table", "table_name", "record_id"),
        Index("idx_activity_log_performed_by", "performed_by"),
        Index("idx_activity_log_occurred_at", "occurred_at"),
        Index("idx_activity_log_operation", "operation"),
    )


class DeletionAuditLog(Base):
    __tablename__ = "deletion_audit_log"

    id         = Column(BigInteger, primary_key=True, autoincrement=True)
    deleted_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    deleted_by = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"))
    table_name = Column(String(100), nullable=False)
    record_id  = Column(Text, nullable=False)
    reason     = Column(Text, nullable=False)
    snapshot   = Column(JSONB, nullable=False)

    __table_args__ = (
        Index("idx_audit_log_table_record", "table_name", "record_id"),
        Index("idx_audit_log_deleted_by", "deleted_by"),
        Index("idx_audit_log_deleted_at", "deleted_at"),
    )