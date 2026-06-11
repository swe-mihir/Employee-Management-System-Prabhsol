# EMS — Authentication & Authorization Documentation

## Overview

The auth system uses **JWT (JSON Web Tokens)** for stateless authentication and **RBAC (Role-Based Access Control)** for authorization. It is built on top of the existing `users`, `roles`, `permissions`, `user_roles`, and `role_permissions` tables.

---

## Stack

| Concern | Library |
|---|---|
| Password hashing | `bcrypt` (direct, v4.0.1) |
| JWT encoding/decoding | `python-jose` with `HS256` |
| Token extraction from requests | FastAPI `OAuth2PasswordBearer` |
| Schema validation | Pydantic v2 |

---

## File Structure

```
backend/app/
├── core/
│   └── security.py       ← password hashing + JWT logic (pure functions, no DB)
├── auth/
│   ├── model.py          ← Role, Permission, UserRole, RolePermission, ActivityLog, DeletionAuditLog
│   ├── schema.py         ← Request/response shapes for auth endpoints
│   ├── repository.py     ← DB queries (get user, get roles, get permissions)
│   ├── service.py        ← Business logic (login, refresh, get_me)
│   ├── deps.py           ← FastAPI dependencies (guards, audited session)
│   └── router.py         ← HTTP endpoints (/login, /refresh, /me)
└── db/
    └── deps.py           ← get_db (reads) + get_audited_db (writes)
```

---

## core/security.py

Pure utility functions. No database, no FastAPI. Everything else calls these.

### Password Hashing

```python
hash_password(plain: str) -> str
verify_password(plain: str, hashed: str) -> bool
```

- Uses `bcrypt` directly (passlib dropped — incompatible with bcrypt 4.x)
- Input is truncated to 72 bytes before hashing — bcrypt's hard limit
- `verify_password` uses constant-time comparison internally (safe against timing attacks)

### TokenData

```python
class TokenData(BaseModel):
    user_id: int
    email: str
    roles: list[str] = []
    permissions: list[str] = []
```

The structured payload baked into every JWT. Decoded tokens always return this object, never a raw dict.

### Token Creation

```python
create_access_token(data: TokenData) -> str   # short-lived (30 min)
create_refresh_token(data: TokenData) -> str  # long-lived (7 days)
```

- Both tokens carry a `type` field (`"access"` or `"refresh"`) to prevent token misuse
- Access token carries `roles` and `permissions` — no DB hit needed on every request
- Refresh token carries only identity (`user_id`, `email`) — its only job is to get a new access token
- Expiry is read from `settings.ACCESS_TOKEN_EXPIRE_MINUTES` (defined in `.env`)

### Token Decoding

```python
decode_access_token(token: str) -> TokenData   # raises ValueError on failure
decode_refresh_token(token: str) -> TokenData  # raises ValueError on failure
```

- Raises `ValueError` on bad signature, expiry, or wrong token type
- The auth dependency catches these and converts them to clean `401` responses

---

## auth/schema.py

Defines the shape of data flowing in and out of auth endpoints.

| Schema | Direction | Used In |
|---|---|---|
| `LoginRequest` | Incoming | `POST /auth/login` |
| `RefreshRequest` | Incoming | `POST /auth/refresh` |
| `TokenResponse` | Outgoing | Login + Refresh responses |
| `UserInfo` | Embedded | Inside `MeResponse` |
| `MeResponse` | Outgoing | `GET /auth/me` |

**Note:** `expires_in` in `TokenResponse` is in **seconds** (e.g. `1800` = 30 minutes). This is the standard convention frontend libraries expect.

---

## auth/repository.py

Raw DB queries. No business logic here.

```python
get_user_by_email(db, email) -> User | None
get_user_by_id(db, user_id) -> User | None
get_user_roles(db, user_id) -> list[str]        # e.g. ["admin", "hr"]
get_user_permissions(db, user_id) -> list[str]  # e.g. ["view_payroll", "edit_employees"]
```

- `get_user_roles` — joins `user_roles → roles`
- `get_user_permissions` — joins `user_roles → role_permissions → permissions` in a single query

---

## auth/service.py

Business logic. Calls repository + security functions.

### login()

```
1. Does the user exist?          → "Invalid credentials" if not (same message as wrong password — don't leak whether email is registered)
2. Is the account active?        → "Account is disabled" if not
3. Is the password correct?      → "Invalid credentials" if not
4. Fetch roles + permissions
5. Return TokenResponse
```

### refresh()

```
1. Decode and validate refresh token
2. Confirm user still exists and is active in DB
3. Re-fetch roles + permissions fresh from DB   ← important: role changes take effect immediately
4. Return new TokenResponse
```

### get_me()

```
1. Load user from DB
2. Reissue a fresh access token using roles already in the current JWT
3. Return MeResponse
```

---

## auth/deps.py

Reusable FastAPI `Depends()` guards. Plug these into any route.

### get_current_user

```python
def get_current_user(token, db) -> TokenData
```

- Reads `Authorization: Bearer <token>` header automatically
- Decodes the JWT
- Confirms the user still exists and is active in DB
- Returns `TokenData` (who is calling)
- Raises `401` on any failure

### require_role

```python
def require_role(*roles: str)
```

- Factory — call it with the roles you want to allow
- User needs **at least one** of the listed roles (OR logic, not AND)
- Raises `403` if not

### require_permission

```python
def require_permission(*permissions: str)
```

- Same pattern as `require_role` but checks permission strings instead
- Use for granular action-level checks regardless of role

### get_audited_session

```python
def get_audited_session(current_user, db) -> Session
```

- Chains off `get_current_user` — user must be authenticated
- Fires `SET LOCAL app.current_user_id = <id>` on the DB session before handing it to the route
- Required for all write routes — this is what populates `performed_by` in the `activity_log`
- `SET LOCAL` resets automatically on commit/rollback — no cross-request leakage

---

## auth/router.py

Thin HTTP layer. No logic — just receives, calls service, returns result or raises HTTP error.

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| POST | `/auth/login` | No | Email + password → both tokens |
| POST | `/auth/refresh` | No | Refresh token → new tokens |
| GET | `/auth/me` | Yes (Bearer) | Current user info + fresh access token |

---

## db/deps.py

| Function | Use For |
|---|---|
| `get_db()` | All read routes + auth routes (no user ID available yet at login) |
| `get_audited_db(user_id)` | Low-level write helper (used internally) |

For write routes, prefer `get_audited_session` from `auth/deps.py` — it handles both auth and audit wiring in one `Depends()`.

---

## Usage on Routes

```python
from app.auth.deps import get_current_user, require_role, require_permission, get_audited_session
from app.core.security import TokenData

# Any logged-in user
@router.get("/profile")
def get_profile(current_user: TokenData = Depends(get_current_user)):
    ...

# Only admin or hr
@router.get("/employees")
def list_employees(current_user: TokenData = Depends(require_role("admin", "hr"))):
    ...

# Specific permission check
@router.get("/payroll")
def view_payroll(current_user: TokenData = Depends(require_permission("view_payroll"))):
    ...

# Write route — auth + audit in one line
@router.post("/employees")
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_audited_session)):
    ...

# Guard without needing current_user inside the function
@router.delete("/employees/{id}", dependencies=[Depends(require_role("admin"))])
def delete_employee(id: str, db: Session = Depends(get_db)):
    ...
```

---

## Token Flow

```
LOGIN
  Client → POST /auth/login (email + password)
  Server → access_token (30 min) + refresh_token (7 days)

AUTHENTICATED REQUEST
  Client → Any protected route with Authorization: Bearer <access_token>
  Server → Decodes token, checks user active, proceeds

TOKEN REFRESH
  Client → POST /auth/refresh (refresh_token)
  Server → New access_token + new refresh_token

SESSION RESTORE (e.g. on page load)
  Client → GET /auth/me with Authorization: Bearer <access_token>
  Server → User info + fresh access_token
```

---

## Audit Trigger Integration

Your DB has a trigger `fn_audit_trigger()` that fires on every write across all main tables. It reads `app.current_user_id` from the session to populate `performed_by` in `activity_log`.

The trigger was updated to handle composite primary keys:

| Table | PK Type | record_id format |
|---|---|---|
| `employees`, `users`, etc. | Single `id` (UUID/int) | Raw ID value |
| `user_roles` | Composite `(user_id, role_id)` | `user_id=1,role_id=2` |
| `role_permissions` | Composite `(role_id, permission_id)` | `role_id=1,permission_id=3` |

**Rule:** Use `get_db` for reads. Use `get_audited_session` for writes. Never use `get_db` on a write route — the audit log will have `NULL` for `performed_by`.

---

## Environment Variables

```env
SECRET_KEY=<long-random-string>
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

Both must be present in `.env` and declared in `core/config.py`:

```python
SECRET_KEY: str
ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
```

---

## Known Issues & Fixes Applied

| Issue | Cause | Fix |
|---|---|---|
| `ValueError: password cannot be longer than 72 bytes` | passlib strict mode | Truncate input to `[:72]` before hashing |
| `error reading bcrypt version` | passlib incompatible with bcrypt 4.x | Dropped passlib, use `bcrypt` directly |
| `record "new" has no field "id"` on `user_roles` insert | Audit trigger assumed all tables have `id` column | Updated `fn_audit_trigger()` to handle composite PKs |
| Swagger Authorize not showing `bearerAuth` field | Bearer scheme not registered in OpenAPI schema | Added `custom_openapi()` to `main.py` |
