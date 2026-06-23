from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token, TokenData
from app.auth import repository as auth_repo
from app.db.deps import get_db

from sqlalchemy import text
from app.db.deps import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> TokenData:
    if not token:
        token = request.query_params.get("token")
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    try:
        token_data = decode_access_token(token)
    except ValueError:
        raise credentials_exception

    # Confirm user still exists and is active in DB
    user = auth_repo.get_user_by_id(db, token_data.user_id)
    if not user or not user.is_active:
        raise credentials_exception

    return token_data


# --- Role guard: is this person allowed? ---

def require_role(*roles: str):
    def dependency(current_user: TokenData = Depends(get_current_user)) -> TokenData:
        if not any(role in current_user.roles for role in roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role: {', '.join(roles)}"
            )
        return current_user
    return dependency


# --- Permission guard: does this person have the right? ---

def require_permission(*permissions: str):
    def dependency(current_user: TokenData = Depends(get_current_user)) -> TokenData:
        if not any(perm in current_user.permissions for perm in permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required permission: {', '.join(permissions)}"
            )
        return current_user
    return dependency



def get_audited_session(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Session:
    db.execute(
        text("SET LOCAL app.current_user_id = :uid"),
        {"uid": str(current_user.user_id)}
    )
    return db