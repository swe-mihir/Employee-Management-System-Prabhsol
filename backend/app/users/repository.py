from sqlalchemy.orm import Session
from sqlalchemy import select, asc, desc
from app.users.model import User
from app.auth.model import Role, UserRole


def get_users(db: Session, sort_by: str = "id", sort_dir: str = "asc",
              skip: int = 0, limit: int = 50):
    sortable = {"id": User.id, "email": User.email, "created_at": User.created_at}
    sort_col = sortable.get(sort_by, User.id)
    q = db.query(User).order_by(asc(sort_col) if sort_dir == "asc" else desc(sort_col))
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return total, items


def get_user_by_id(db: Session, user_id: int):
    return db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()


def get_user_by_email(db: Session, email: str):
    return db.execute(select(User).where(User.email == email)).scalar_one_or_none()


def get_role_by_name(db: Session, name: str):
    return db.execute(select(Role).where(Role.role_name == name)).scalar_one_or_none()


def set_user_role(db: Session, user_id: int, role_id: int):
    db.query(UserRole).filter(UserRole.user_id == user_id).delete()
    db.add(UserRole(user_id=user_id, role_id=role_id))
    db.flush()


def create_user(db: Session, data: dict) -> User:
    user = User(**data)
    db.add(user)
    db.flush()
    return user


def update_user(db: Session, user: User, data: dict) -> User:
    for k, v in data.items():
        setattr(user, k, v)
    db.flush()
    return user