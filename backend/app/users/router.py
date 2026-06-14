from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.users.schema import UserCreate, UserUpdate, UserResponse, UserListResponse
from app.users import service as user_service
from app.auth.deps import require_role, get_audited_session
from app.db.deps import get_db

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=UserListResponse)
def list_users(
    sort_by: str = Query("id"),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _=Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    return user_service.list_users(db, page, page_size, sort_by, sort_dir)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    _=Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    try:
        return user_service.get_user(db, user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_audited_session),
    _=Depends(require_role("admin")),
):
    try:
        return user_service.create_user(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_audited_session),
    _=Depends(require_role("admin")),
):
    try:
        return user_service.update_user(db, user_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))