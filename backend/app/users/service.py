from sqlalchemy.orm import Session
from sqlalchemy import select
from app.users import repository
from app.users.schema import UserCreate, UserUpdate, UserResponse, UserListResponse
from app.employees.model import Employee
from app.auth.model import UserRole, Role
from app.core.security import hash_password


def _enrich(db: Session, user) -> UserResponse:
    emp_name = ""
    if user.employee_id:
        emp = db.execute(select(Employee).where(Employee.id == user.employee_id)).scalar_one_or_none()
        if emp:
            emp_name = emp.name

    role_row = (db.execute(
        select(Role.role_name)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user.id)
    ).scalar_one_or_none())

    return UserResponse(
        id=user.id,
        employee_id=user.employee_id,
        employee_name=emp_name,
        email=user.email,
        role=role_row or "",
        is_active=user.is_active,
        created_at=user.created_at,
    )


def list_users(db: Session, page: int, page_size: int,
               sort_by: str, sort_dir: str) -> UserListResponse:
    skip = (page - 1) * page_size
    total, items = repository.get_users(db, sort_by, sort_dir, skip, page_size)
    return UserListResponse(total=total, items=[_enrich(db, u) for u in items])


def get_user(db: Session, user_id: int) -> UserResponse:
    user = repository.get_user_by_id(db, user_id)
    if not user:
        raise ValueError("User not found")
    return _enrich(db, user)


def create_user(db: Session, payload: UserCreate) -> UserResponse:
    VALID_ROLES = {"admin", "manager", "employee"}
    if payload.role not in VALID_ROLES:
        raise ValueError(f"Role must be one of: {', '.join(VALID_ROLES)}")

    emp = db.execute(select(Employee).where(Employee.id == payload.employee_id)).scalar_one_or_none()
    if not emp:
        raise ValueError("Employee not found")

    if repository.get_user_by_email(db, payload.email):
        raise ValueError("Email already in use")

    user = repository.create_user(db, {
        "employee_id": payload.employee_id,
        "email": payload.email,
        "password_hash": hash_password(payload.password),
        "is_active": True,
    })

    role = repository.get_role_by_name(db, payload.role)
    if not role:
        raise ValueError(f"Role '{payload.role}' not found in DB")
    repository.set_user_role(db, user.id, role.id)

    db.commit()
    db.refresh(user)
    return _enrich(db, user)


def update_user(db: Session, user_id: int, payload: UserUpdate) -> UserResponse:
    user = repository.get_user_by_id(db, user_id)
    if not user:
        raise ValueError("User not found")

    data = {}
    if payload.email is not None:
        existing = repository.get_user_by_email(db, payload.email)
        if existing and existing.id != user_id:
            raise ValueError("Email already in use")
        data["email"] = payload.email

    if payload.password:
        data["password_hash"] = hash_password(payload.password)

    if data:
        repository.update_user(db, user, data)

    if payload.role is not None:
        role = repository.get_role_by_name(db, payload.role)
        if not role:
            raise ValueError(f"Role '{payload.role}' not found in DB")
        repository.set_user_role(db, user.id, role.id)

    db.commit()
    db.refresh(user)
    return _enrich(db, user)