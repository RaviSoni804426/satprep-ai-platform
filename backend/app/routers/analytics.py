from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.schemas import StudentAnalyticsOut, PlatformAnalyticsOut
from app.routers.deps import get_current_user, require_role
from app.models.models import User
from app.services.analytics_service import AnalyticsService
from app.repository.db_repo import UserRepository

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/me", response_model=StudentAnalyticsOut)
def get_my_analytics(current_user: User = Depends(require_role(["student"])), db: Session = Depends(get_db)):
    return AnalyticsService.get_student_analytics(db, current_user.id)

@router.get("/students/{student_id}", response_model=StudentAnalyticsOut)
def get_student_analytics(
    student_id: str,
    current_user: User = Depends(require_role(["counsellor", "admin"])),
    db: Session = Depends(get_db)
):
    student = UserRepository.get_by_id(db, student_id)
    if not student or student.role != "student":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
        
    # Verify counsellor access boundary
    if current_user.role == "counsellor":
        profile = student.profile
        if not profile or profile.counsellor_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="FORBIDDEN")
            
    return AnalyticsService.get_student_analytics(db, student_id)

@router.get("/platform", response_model=PlatformAnalyticsOut)
def get_platform_analytics(
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    return AnalyticsService.get_platform_analytics(db)
