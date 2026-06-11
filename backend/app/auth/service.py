from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    TokenData
)
from app.auth.schema import TokenResponse, UserInfo, MeResponse
from app.auth import repository as auth_repo
from app.users.model import User


def _build_token_response(user: User, roles: list[str], permissions: list[str]) -> TokenResponse:
    token_data = TokenData(
        user_id=user.id,
        email=user.email,
        roles=roles,
        permissions=permissions
    )
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


def login(db: Session, email: str, password: str) -> TokenResponse:
    # 1. User exists?
    user = auth_repo.get_user_by_email(db, email)
    if not user:
        raise ValueError("Invalid credentials")

    # 2. Account active?
    if not user.is_active:
        raise ValueError("Account is disabled")

    # 3. Password correct?
    if not verify_password(password, user.password_hash):
        raise ValueError("Invalid credentials")

    # 4. Fetch roles + permissions
    roles = auth_repo.get_user_roles(db, user.id)
    permissions = auth_repo.get_user_permissions(db, user.id)

    return _build_token_response(user, roles, permissions)


def refresh(db: Session, refresh_token: str) -> TokenResponse:
    # 1. Decode and validate refresh token
    try:
        token_data = decode_refresh_token(refresh_token)
    except ValueError:
        raise ValueError("Invalid or expired refresh token")

    # 2. User still exists and is active?
    user = auth_repo.get_user_by_id(db, token_data.user_id)
    if not user or not user.is_active:
        raise ValueError("Account not found or disabled")

    # 3. Re-fetch fresh roles + permissions from DB
    roles = auth_repo.get_user_roles(db, user.id)
    permissions = auth_repo.get_user_permissions(db, user.id)

    return _build_token_response(user, roles, permissions)


def get_me(db: Session, user_id: int, roles: list[str], permissions: list[str]) -> MeResponse:
    user = auth_repo.get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise ValueError("Account not found or disabled")

    token_data = TokenData(
        user_id=user.id,
        email=user.email,
        roles=roles,
        permissions=permissions
    )

    return MeResponse(
        user=UserInfo(
            id=user.id,
            employee_id=str(user.employee_id),
            email=user.email,
            roles=roles,
            permissions=permissions
        ),
        access_token=create_access_token(token_data),
        token_type="bearer"
    )