from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.schemas import UserOut, UserProfileUpdate
from app.models.models import User, StudentProfile
from app.routers.deps import get_current_user, require_role
from app.repository.db_repo import UserRepository
from typing import Optional

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Load profile details if student
    target_score = None
    counsellor_id = None
    if current_user.role == "student" and current_user.profile:
        target_score = current_user.profile.target_score
        counsellor_id = current_user.profile.counsellor_id
        
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "full_name": current_user.full_name,
        "target_score": target_score,
        "counsellor_id": counsellor_id,
        "is_active": current_user.is_active
    }

@router.patch("/me", response_model=UserOut)
def update_me(
    data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "student":
        profile = current_user.profile
        if not profile:
            profile = StudentProfile(user_id=current_user.id)
            db.add(profile)
            db.commit()
            db.refresh(profile)
            
        if data.target_score is not None:
            profile.target_score = data.target_score
        if data.target_test_date is not None:
            profile.target_test_date = data.target_test_date
            
        db.commit()
        db.refresh(profile)
        
    target_score = current_user.profile.target_score if (current_user.role == "student" and current_user.profile) else None
    counsellor_id = current_user.profile.counsellor_id if (current_user.role == "student" and current_user.profile) else None
    
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "full_name": current_user.full_name,
        "target_score": target_score,
        "counsellor_id": counsellor_id,
        "is_active": current_user.is_active
    }

@router.get("", dependencies=[Depends(require_role(["admin"]))])
def get_all_users(
    role: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    users = UserRepository.list_users(db, role, search, page, limit)
    total = UserRepository.count_users(db, role, search)
    
    data = []
    for u in users:
        target_score = u.profile.target_score if (u.role == "student" and u.profile) else None
        counsellor_id = u.profile.counsellor_id if (u.role == "student" and u.profile) else None
        data.append({
            "id": u.id,
            "email": u.email,
            "role": u.role,
            "full_name": u.full_name,
            "target_score": target_score,
            "counsellor_id": counsellor_id,
            "is_active": u.is_active
        })
        
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "data": data
    }
