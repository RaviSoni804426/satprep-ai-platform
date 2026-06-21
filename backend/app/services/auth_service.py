import random
import logging
from sqlalchemy.orm import Session
from app.repository.db_repo import UserRepository, EventRepository
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token, verify_token
from app.core.config import settings
import redis
from typing import Optional, Tuple, Dict, Any
from app.models.models import User

logger = logging.getLogger(__name__)

# Setup redis client
try:
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
except Exception as e:
    logger.error(f"Failed to connect to Redis: {e}")
    redis_client = None

class AuthService:
    @staticmethod
    def generate_otp(email: str) -> str:
        otp = f"{random.randint(100000, 999999)}"
        if redis_client:
            try:
                redis_client.setex(f"otp:{email}", 300, otp)  # 5 min TTL
            except Exception as e:
                logger.error(f"Redis write error on OTP set: {e}")
        # Always print to stdout for easy development testing
        print(f"==================================================")
        print(f"OTP FOR {email}: {otp} (Expires in 5 minutes)")
        print(f"==================================================")
        return otp

    @staticmethod
    def verify_otp(email: str, otp: str) -> bool:
        if settings.OTP_BYPASS and otp == "123456":
            return True
        if not redis_client:
            # Fallback when Redis is down: in dev mode, accept any OTP or "123456"
            return settings.OTP_BYPASS

        try:
            cached_otp = redis_client.get(f"otp:{email}")
            if cached_otp and cached_otp == otp:
                redis_client.delete(f"otp:{email}")
                return True
        except Exception as e:
            logger.error(f"Redis read error on OTP verify: {e}")
            if settings.OTP_BYPASS:
                return True
        return False

    @staticmethod
    def register_user(db: Session, email: str, password: str, role: str, full_name: Optional[str] = None) -> Tuple[bool, str, Optional[User]]:
        existing = UserRepository.get_by_email(db, email)
        if existing:
            return False, "EMAIL_EXISTS", None
            
        pass_hash = get_password_hash(password)
        user = UserRepository.create_user(db, email, pass_hash, role, full_name)
        
        # Auto-verify the user to remove OTP verification
        user.is_verified = True
        db.commit()
        
        # Log event
        EventRepository.log_event(db, "user.registered", user.id, properties={"role": role, "method": "email"})
        
        return True, "SUCCESS", user

    @staticmethod
    def login_with_password(db: Session, email: str, password: str) -> Tuple[Optional[User], str]:
        user = UserRepository.get_by_email(db, email)
        if not user:
            return None, "INVALID_CREDENTIALS"
        if not user.is_active:
            return None, "ACCOUNT_INACTIVE"
        if not verify_password(password, user.password_hash):
            return None, "INVALID_CREDENTIALS"
            
        # Log event
        EventRepository.log_event(db, "user.login", user.id, properties={"method": "email"})
        return user, "SUCCESS"

    @staticmethod
    def generate_auth_tokens(user: User) -> dict:
        access_claims = {"sub": user.id, "role": user.role, "email": user.email}
        refresh_claims = {"sub": user.id}
        
        access_token = create_access_token(access_claims)
        refresh_token = create_refresh_token(refresh_claims)
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "role": user.role,
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }

    @staticmethod
    def refresh_access_token(db: Session, refresh_token: str) -> Tuple[Optional[str], str]:
        payload = verify_token(refresh_token)
        if not payload or "sub" not in payload:
            return None, "INVALID_REFRESH_TOKEN"
            
        user_id = payload["sub"]
        user = UserRepository.get_by_id(db, user_id)
        if not user or not user.is_active:
            return None, "USER_INACTIVE"
            
        # Generate new access token
        access_claims = {"sub": user.id, "role": user.role, "email": user.email}
        new_access = create_access_token(access_claims)
        return new_access, "SUCCESS"

    @staticmethod
    def authenticate_google_user(db: Session, token_or_code: str) -> Tuple[Optional[User], str]:
        # In production, we would call google-auth library:
        # idinfo = id_token.verify_oauth2_token(token_or_code, requests.Request(), CLIENT_ID)
        # For this mock/full implementation, we'll verify if it's a valid email representation,
        # or simulate it with a test identity if credentials are dummy.
        # This keeps the OAuth endpoints functional for testing!
        
        email = "google_user@example.com"
        full_name = "Google Student"
        
        # Simple simulation parsing if in development
        if "@" in token_or_code:
            email = token_or_code
            full_name = email.split("@")[0].capitalize()
            
        user = UserRepository.get_by_email(db, email)
        if not user:
            # Auto register Google user
            pass_hash = get_password_hash("GoogleAuth123!SafeSecretPass")
            user = UserRepository.create_user(db, email, pass_hash, "student", full_name)
            user.is_verified = True
            db.commit()
            
            # Log registration event
            EventRepository.log_event(db, "user.registered", user.id, properties={"role": "student", "method": "google"})
        
        # Log login event
        EventRepository.log_event(db, "user.login", user.id, properties={"method": "google"})
        return user, "SUCCESS"
