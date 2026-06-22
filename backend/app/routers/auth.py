from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.schemas import UserRegister, UserLogin, OTPVerify, Token, TokenRefreshRequest, TokenRefreshResponse
from app.services.auth_service import AuthService
from app.repository.db_repo import UserRepository
from app.core.config import settings
from app.services.email_service import verify_action_token, EmailService
from typing import Dict, Any, Optional
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(data: UserRegister, response: Response, request: Request, db: Session = Depends(get_db)):
    success, message, user = AuthService.register_user(
        db, data.email, data.password, data.role, data.full_name,
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent")
    )
    if not success:
        if message == "EMAIL_EXISTS":
            raise HTTPException(status_code=400, detail="EMAIL_EXISTS")
        raise HTTPException(status_code=422, detail="VALIDATION_ERROR")
        
    if message == "OTP_REQUIRED":
        raise HTTPException(status_code=401, detail="OTP_REQUIRED")
        
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
def verify_otp(data: OTPVerify, response: Response, request: Request, db: Session = Depends(get_db)):
    verified = AuthService.verify_otp(data.email, data.otp)
    if not verified:
        raise HTTPException(status_code=401, detail="INVALID_OTP")
        
    user = UserRepository.get_by_email(db, data.email)
    if not user:
        raise HTTPException(status_code=404, detail="USER_NOT_FOUND")
        
    # Mark verified
    user.is_verified = True
    user.approval_status = "Pending"
    db.commit()
    
    # Send email notifications
    EmailService.send_admin_approval_request_email(user, request=request)
    EmailService.send_user_pending_email(user)
    
    # User cannot log in immediately; raise APPROVAL_PENDING error
    raise HTTPException(status_code=403, detail="APPROVAL_PENDING")

@router.post("/login", response_model=Token)
def login(data: UserLogin, response: Response, db: Session = Depends(get_db)):
    user, status_msg = AuthService.login_with_password(db, data.email, data.password)
    if status_msg == "INVALID_CREDENTIALS":
        raise HTTPException(status_code=401, detail="INVALID_CREDENTIALS")
    elif status_msg == "OTP_REQUIRED":
        raise HTTPException(status_code=401, detail="OTP_REQUIRED")
    elif status_msg == "ACCOUNT_SUSPENDED":
        raise HTTPException(status_code=403, detail="ACCOUNT_SUSPENDED")
    elif status_msg == "APPROVAL_PENDING":
        raise HTTPException(status_code=403, detail="APPROVAL_PENDING")
    elif status_msg == "REGISTRATION_REJECTED":
        raise HTTPException(status_code=403, detail="REGISTRATION_REJECTED")
        
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
    if status_msg == "APPROVAL_PENDING":
        raise HTTPException(status_code=403, detail="APPROVAL_PENDING")
    elif status_msg == "REGISTRATION_REJECTED":
        raise HTTPException(status_code=403, detail="REGISTRATION_REJECTED")
    elif status_msg == "ACCOUNT_SUSPENDED":
        raise HTTPException(status_code=403, detail="ACCOUNT_SUSPENDED")
    elif status_msg != "SUCCESS":
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

@router.get("/action", response_class=HTMLResponse)
def email_action(token: str, db: Session = Depends(get_db)):
    payload = verify_action_token(token)
    if not payload:
        return HTMLResponse(content="""
        <html>
            <head>
                <title>Invalid Action Link</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc; }
                    .card { background: white; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); text-align: center; max-width: 400px; border: 1px solid #fee2e2; }
                    h1 { color: #dc2626; font-size: 1.5rem; margin-top: 0; }
                    p { color: #475569; font-size: 0.95rem; line-height: 1.5; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>❌ Invalid or Expired Link</h1>
                    <p>This quick action link has expired or is invalid. Please log in to the admin dashboard to review registrations manually.</p>
                </div>
            </body>
        </html>
        """, status_code=400)
        
    user_id = payload.get("sub")
    action = payload.get("action")
    
    user = UserRepository.get_by_id(db, user_id)
    if not user:
        return HTMLResponse(content="<h1>User Not Found</h1>", status_code=404)
        
    if action == "approve":
        user.approval_status = "Approved"
        user.is_active = True
        user.approval_date = datetime.utcnow()
        user.approval_notes = "Approved via email quick action"
        db.commit()
        
        EmailService.send_user_approved_email(user)
        
        return HTMLResponse(content=f"""
        <html>
            <head>
                <title>User Approved</title>
                <style>
                    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc; }}
                    .card {{ background: white; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); text-align: center; max-width: 450px; border: 1px solid #e2e8f0; }}
                    h1 {{ color: #16a34a; font-size: 1.5rem; margin-top: 0; }}
                    p {{ color: #475569; font-size: 0.95rem; line-height: 1.5; }}
                    .btn {{ display: inline-block; margin-top: 1.5rem; padding: 0.75rem 1.5rem; background-color: #2563eb; color: white; text-decoration: none; border-radius: 0.5rem; font-weight: bold; font-size: 0.9rem; }}
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>✅ User Approved Successfully</h1>
                    <p>The registration request for <strong>{user.full_name or user.email}</strong> is now approved.</p>
                    <p>An email notification has been dispatched to them. They can now log in.</p>
                    <a class="btn" href="{settings.FRONTEND_URL}/admin">Go to Admin Dashboard</a>
                </div>
            </body>
        </html>
        """)
        
    elif action == "reject":
        user.approval_status = "Rejected"
        user.rejection_reason = "Declined by Admin via email quick action"
        user.approval_date = datetime.utcnow()
        db.commit()
        
        EmailService.send_user_rejected_email(user, reason="Declined by Admin via email quick action")
        
        return HTMLResponse(content=f"""
        <html>
            <head>
                <title>User Rejected</title>
                <style>
                    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc; }}
                    .card {{ background: white; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); text-align: center; max-width: 450px; border: 1px solid #e2e8f0; }}
                    h1 {{ color: #dc2626; font-size: 1.5rem; margin-top: 0; }}
                    p {{ color: #475569; font-size: 0.95rem; line-height: 1.5; }}
                    .btn {{ display: inline-block; margin-top: 1.5rem; padding: 0.75rem 1.5rem; background-color: #2563eb; color: white; text-decoration: none; border-radius: 0.5rem; font-weight: bold; font-size: 0.9rem; }}
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>❌ Registration Declined</h1>
                    <p>The registration request for <strong>{user.full_name or user.email}</strong> has been rejected.</p>
                    <p>An email notification has been sent informing the user.</p>
                    <a class="btn" href="{settings.FRONTEND_URL}/admin">Go to Admin Dashboard</a>
                </div>
            </body>
        </html>
        """)
        
    return HTMLResponse(content="<h1>Invalid Action</h1>", status_code=400)
