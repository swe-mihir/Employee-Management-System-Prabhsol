from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.schema import LoginRequest, RefreshRequest, TokenResponse, MeResponse
from app.auth import service as auth_service
from app.auth.deps import get_current_user
from app.core.security import TokenData
from app.db.deps import get_db

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    try:
        return auth_service.login(db, payload.email, payload.password)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    try:
        return auth_service.refresh(db, payload.refresh_token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )


@router.get("/me", response_model=MeResponse)
def me(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return auth_service.get_me(
            db,
            current_user.user_id,
            current_user.roles,
            current_user.permissions
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )