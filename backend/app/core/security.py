from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from app.core.config import settings


# --- Password hashing ---

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain[:72])

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain[:72], hashed)


# --- Token payload model ---

class TokenData(BaseModel):
    user_id: int
    email: str
    employee_id: Optional[str] = None
    roles: list[str] = []
    permissions: list[str] = []


# --- Token creation ---

def create_access_token(data: TokenData) -> str:
    expires = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(data.user_id),
        "email": data.email,
        "employee_id": data.employee_id,
        "roles": data.roles,
        "permissions": data.permissions,
        "exp": expires,
        "type": "access"
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def create_refresh_token(data: TokenData) -> str:
    expires = datetime.now(timezone.utc) + timedelta(days=7)
    payload = {
        "sub": str(data.user_id),
        "email": data.email,
        "exp": expires,
        "type": "refresh"
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


# --- Token decoding ---

def decode_access_token(token: str) -> TokenData:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except JWTError:
        raise ValueError("Invalid or expired token")

    if payload.get("type") != "access":
        raise ValueError("Wrong token type")

    return TokenData(
        user_id=int(payload["sub"]),
        email=payload["email"],
        roles=payload.get("roles", []),
        permissions=payload.get("permissions", []),
        employee_id=payload.get("employee_id")
    )


def decode_refresh_token(token: str) -> TokenData:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except JWTError:
        raise ValueError("Invalid or expired token")

    if payload.get("type") != "refresh":
        raise ValueError("Wrong token type")

    return TokenData(
        user_id=int(payload["sub"]),
        email=payload["email"]
    )