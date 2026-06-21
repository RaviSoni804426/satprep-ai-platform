from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.schemas import UserRegister, UserLogin, OTPVerify, Token, TokenRefreshRequest, TokenRefreshResponse
from app.services.auth_service import AuthService
from app.repository.db_repo import UserRepository
from typing import Dict, Any, Optional

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(data: UserRegister, response: Response, db: Session = Depends(get_db)):
    success, message, user = AuthService.register_user(
        db, data.email, data.password, data.role, data.full_name
    )
    if not success:
        if message == "EMAIL_EXISTS":
            raise HTTPException(status_code=400, detail="EMAIL_EXISTS")
        raise HTTPException(status_code=422, detail="VALIDATION_ERROR")
        
    tokens = AuthService.generate_auth_tokens(user)
    
    # Store refresh token in HttpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=True,
        max_age=7 * 24 * 3600,
        samesite="lax",
        secure=False
    )
    return tokens

@router.post("/otp/verify", response_model=Token)
def verify_otp(data: OTPVerify, response: Response, db: Session = Depends(get_db)):
    verified = AuthService.verify_otp(data.email, data.otp)
    if not verified:
        raise HTTPException(status_code=401, detail="INVALID_OTP")
        
    user = UserRepository.get_by_email(db, data.email)
    if not user:
        raise HTTPException(status_code=404, detail="USER_NOT_FOUND")
        
    # Mark verified
    user.is_verified = True
    db.commit()
    
    tokens = AuthService.generate_auth_tokens(user)
    
    # Store refresh token in HttpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=True,
        max_age=7 * 24 * 3600,
        samesite="lax",
        secure=False  # Set true in production if SSL is active
    )
    return tokens

@router.post("/login", response_model=Token)
def login(data: UserLogin, response: Response, db: Session = Depends(get_db)):
    user, status_msg = AuthService.login_with_password(db, data.email, data.password)
    if status_msg == "INVALID_CREDENTIALS":
        raise HTTPException(status_code=401, detail="INVALID_CREDENTIALS")
    elif status_msg == "ACCOUNT_INACTIVE":
        raise HTTPException(status_code=403, detail="ACCOUNT_INACTIVE")
        
    # Standard email login OTP verification has been removed as per user request
    # if not user.is_verified:
    #     AuthService.generate_otp(user.email)
    #     raise HTTPException(status_code=401, detail="OTP_REQUIRED")
        
    tokens = AuthService.generate_auth_tokens(user)
    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=True,
        max_age=7 * 24 * 3600,
        samesite="lax",
        secure=False
    )
    return tokens

@router.post("/refresh", response_model=TokenRefreshResponse)
def refresh_token(request: Request, data: Optional[TokenRefreshRequest] = None, db: Session = Depends(get_db)):
    # Fallback to cookie if body is missing
    r_token = None
    if data and data.refresh_token:
        r_token = data.refresh_token
    else:
        r_token = request.cookies.get("refresh_token")
        
    if not r_token:
        raise HTTPException(status_code=401, detail="INVALID_REFRESH_TOKEN")
        
    new_access, status_msg = AuthService.refresh_access_token(db, r_token)
    if status_msg != "SUCCESS":
        raise HTTPException(status_code=401, detail="INVALID_REFRESH_TOKEN")
        
    return {"access_token": new_access, "expires_in": 900}

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("refresh_token")
    return {"message": "Logged out"}

@router.post("/google", response_model=Token)
def google_auth(data: Dict[str, str], response: Response, db: Session = Depends(get_db)):
    token_or_code = data.get("credential") or data.get("code")
    if not token_or_code:
        raise HTTPException(status_code=422, detail="VALIDATION_ERROR")
        
    user, status_msg = AuthService.authenticate_google_user(db, token_or_code)
    if status_msg != "SUCCESS":
        raise HTTPException(status_code=401, detail="INVALID_CREDENTIALS")
        
    tokens = AuthService.generate_auth_tokens(user)
    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=True,
        max_age=7 * 24 * 3600,
        samesite="lax",
        secure=False
    )
    return tokens
