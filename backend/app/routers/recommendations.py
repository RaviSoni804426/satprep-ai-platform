from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.schemas import RecommendationOut
from app.routers.deps import require_role
from app.models.models import User
from app.repository.db_repo import RecommendationRepository
from typing import List, Dict

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])

@router.get("/me", response_model=Dict[str, List[RecommendationOut]])
def get_my_recommendations(
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db)
):
    recs = RecommendationRepository.get_by_student(db, current_user.id)
    return {"data": recs}

@router.patch("/{rec_id}/dismiss")
def dismiss_recommendation(
    rec_id: str,
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db)
):
    success = RecommendationRepository.dismiss(db, rec_id, current_user.id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recommendation not found")
    return {"dismissed": True}
