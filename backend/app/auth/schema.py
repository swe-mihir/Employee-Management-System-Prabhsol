from pydantic import BaseModel


# --- Request schemas ---

class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


# --- Response schemas ---

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


# --- Embedded in responses ---

class UserInfo(BaseModel):
    id: int
    employee_id: str
    email: str
    roles: list[str]
    permissions: list[str]

    class Config:
        from_attributes = True


class MeResponse(BaseModel):
    user: UserInfo
    access_token: str
    token_type: str = "bearer"