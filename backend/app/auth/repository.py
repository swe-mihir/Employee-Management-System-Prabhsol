from sqlalchemy.orm import Session
from sqlalchemy import select

from app.users.model import User
from app.auth.model import Role, UserRole, RolePermission, Permission


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.execute(
        select(User).where(User.email == email)
    ).scalar_one_or_none()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.execute(
        select(User).where(User.id == user_id)
    ).scalar_one_or_none()


def get_user_roles(db: Session, user_id: int) -> list[str]:
    rows = db.execute(
        select(Role.role_name)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id)
    ).scalars().all()
    return list(rows)


def get_user_permissions(db: Session, user_id: int) -> list[str]:
    rows = db.execute(
        select(Permission.permission_name)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(UserRole, UserRole.role_id == RolePermission.role_id)
        .where(UserRole.user_id == user_id)
    ).scalars().all()
    return list(rows)