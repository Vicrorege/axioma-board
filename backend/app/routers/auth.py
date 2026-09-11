from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Header
from app.services.auth_store import (
    auth_store, UserRegister, UserLogin, UserResponse, AuthTokenResponse
)

router = APIRouter(prefix="/api/auth", tags=["User Accounts & Authentication"])

async def get_current_user_optional(authorization: Optional[str] = Header(default=None)) -> Optional[UserResponse]:
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "").strip()
    return auth_store.get_user_by_token(token)

async def get_current_user_required(authorization: Optional[str] = Header(default=None)) -> UserResponse:
    user = await get_current_user_optional(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user

@router.post("/register", response_model=AuthTokenResponse, summary="Register a new user")
async def register_user(payload: UserRegister):
    res = auth_store.register(payload)
    if not res:
        raise HTTPException(status_code=400, detail="Username already taken")
    return res

@router.post("/login", response_model=AuthTokenResponse, summary="Log in with username and password")
async def login_user(payload: UserLogin):
    res = auth_store.login(payload)
    if not res:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return res

@router.get("/me", response_model=UserResponse, summary="Get current logged in user")
async def get_current_profile(user: UserResponse = Depends(get_current_user_required)):
    return user

@router.post("/logout", summary="Log out and invalidate session")
async def logout_user(authorization: Optional[str] = Header(default=None)):
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        auth_store.logout(token)
    return {"success": True}
