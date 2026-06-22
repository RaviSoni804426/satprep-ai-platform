from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.schemas import CoachQuestionRequest, CoachResponse
from app.routers.deps import get_current_user, require_role
from app.models.models import User
from app.services.coach_service import CoachService

router = APIRouter(prefix="/coach", tags=["AI Study Coach"])

@router.post("/ask", response_model=CoachResponse)
def ask_coach(
    data: CoachQuestionRequest,
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db)
):
    result = CoachService.answer_student_question(db, current_user.id, data.question)
    return result
