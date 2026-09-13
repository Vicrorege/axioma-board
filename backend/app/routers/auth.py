from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Header
from app.services.auth_store import (
    auth_store,
    UserRegisterRequest,
    VerifyEmailRequest,
    ResendCodeRequest,
    UserLoginRequest,
    UserResponse,
    AuthTokenResponse,
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

@router.post("/register-request", summary="Request account registration with email verification code")
async def register_request(payload: UserRegisterRequest):
    """Initiates registration and sends a 6-digit verification code to the specified email."""
    res = auth_store.request_registration(payload)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Registration request failed"))
    return res

@router.post("/verify-email", response_model=AuthTokenResponse, summary="Verify code and complete registration")
async def verify_email(payload: VerifyEmailRequest):
    """Verifies the 6-digit code sent to the email and activates the account."""
    res = auth_store.verify_email_and_register(payload)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Invalid verification code"))
    return res.get("data")

@router.post("/resend-code", summary="Resend verification code to email")
async def resend_code(payload: ResendCodeRequest):
    res = auth_store.resend_code(payload.email)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to resend code"))
    return res

@router.post("/login", summary="Log in with email/username and password")
async def login_user(payload: UserLoginRequest):
    res = auth_store.login(payload)
    if not res.get("success"):
        if res.get("needs_verification"):
            return {
                "needs_verification": True,
                "email": res.get("email"),
                "message": res.get("error")
            }
        raise HTTPException(status_code=401, detail=res.get("error", "Invalid login or password"))
    return res.get("data")

@router.get("/me", response_model=UserResponse, summary="Get current logged in user")
async def get_current_profile(user: UserResponse = Depends(get_current_user_required)):
    return user

@router.post("/logout", summary="Log out and invalidate session")
async def logout_user(authorization: Optional[str] = Header(default=None)):
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        auth_store.logout(token)
    return {"success": True}
