from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.schemas import TestOut, SessionStartOut, AnswerSubmit, ScoreOut, SessionResumeOut, SubmitAnswerInput, SubmitAnswerOut
from app.routers.deps import get_current_user, require_role
from app.models.models import User, TestSession, SessionAnswer
from app.services.test_service import TestService
from app.repository.db_repo import QuestionRepository, TestRepository, ScoreRepository, SessionRepository
from app.tasks.scoring_task import process_score_and_recommendations
from typing import List, Dict, Any, Optional
from datetime import datetime

router = APIRouter(tags=["Tests & Sessions"])

@router.get("/tests", response_model=Dict[str, List[TestOut]])
def get_tests(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tests = TestRepository.list_active_tests(db)
    return {"data": tests}

@router.post("/tests/{test_id}/start", status_code=status.HTTP_201_CREATED, response_model=SessionStartOut)
def start_test(test_id: str, current_user: User = Depends(require_role(["student"])), db: Session = Depends(get_db)):
    sess, q_no, total_qs, time_limit, time_remaining, questions, msg = TestService.start_session(db, current_user.id, test_id)
    if msg == "TEST_NOT_FOUND":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TEST_NOT_FOUND")
        
    formatted_qs = []
    for q in questions:
        formatted_qs.append({
            "id": q.id,
            "body": q.body,
            "option_a": q.option_a,
            "option_b": q.option_b,
            "option_c": q.option_c,
            "option_d": q.option_d,
            "difficulty": q.difficulty,
            "topic_id": q.topic_id,
            "subject": q.topic.subject if q.topic else "reading"
        })
        
    return {
        "session_id": sess.id,
        "current_question_no": q_no,
        "total_questions": total_qs,
        "time_limit_seconds": time_limit,
        "time_remaining": time_remaining,
        "questions": formatted_qs
    }

@router.post("/sessions/{session_id}/answers")
def save_answers(
    session_id: str,
    data: AnswerSubmit,
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db)
):
    success = TestService.autosave_answers(db, session_id, data.answers, data.flagged, data.time_remaining)
    if not success:
        raise HTTPException(status_code=403, detail="SESSION_MISMATCH")
    return {"saved": True, "saved_at": datetime.utcnow().isoformat()}

@router.post("/sessions/{session_id}/submit-answer", response_model=SubmitAnswerOut)
def submit_question_answer(
    session_id: str,
    data: SubmitAnswerInput,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db)
):
    status_msg, next_q, q_no, code = TestService.submit_answer(
        db, session_id, data.question_id, data.selected_option,
        data.time_taken_seconds, data.is_flagged, data.time_remaining
    )
    if code == "SESSION_NOT_FOUND":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SESSION_NOT_FOUND")
        
    if status_msg == "completed":
        background_tasks.add_task(process_score_and_recommendations, session_id, current_user.id)
        return {
            "session_status": "completed",
            "current_question_no": q_no,
            "next_question": None
        }
        
    formatted_next = None
    if next_q:
        formatted_next = {
            "id": next_q.id,
            "body": next_q.body,
            "option_a": next_q.option_a,
            "option_b": next_q.option_b,
            "option_c": next_q.option_c,
            "option_d": next_q.option_d,
            "difficulty": next_q.difficulty,
            "topic_id": next_q.topic_id,
            "subject": next_q.topic.subject if next_q.topic else "reading"
        }
        
    return {
        "session_status": "in_progress",
        "current_question_no": q_no,
        "next_question": formatted_next
    }

@router.post("/sessions/{session_id}/submit", status_code=status.HTTP_202_ACCEPTED)
def submit_test(
    session_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db)
):
    success = TestService.final_submit(db, session_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SESSION_ALREADY_COMPLETED")
        
    background_tasks.add_task(process_score_and_recommendations, session_id, current_user.id)
    
    return {
        "status": "processing",
        "message": "Score will be ready in under 10 seconds"
    }

@router.get("/sessions/{session_id}/score", response_model=ScoreOut)
def get_score(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sess = SessionRepository.get_session_by_id(db, session_id)
    if not sess:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SESSION_NOT_FOUND")

    score = ScoreRepository.get_score_by_session(db, session_id)
    if not score:
        if sess.status == "in_progress":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SESSION_IN_PROGRESS")
            
        raise HTTPException(
            status_code=status.HTTP_202_ACCEPTED,
            detail="SCORE_PROCESSING"
        )
        
    if current_user.role == "student" and sess.student_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="FORBIDDEN")
    elif current_user.role == "counsellor":
        profile = sess.student.profile
        if not profile or profile.counsellor_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="FORBIDDEN")
            
    return score

@router.get("/sessions/{session_id}/resume", response_model=SessionResumeOut)
def resume_session(
    session_id: str,
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db)
):
    state, status_msg = TestService.resume_session(db, session_id)
    if status_msg == "SESSION_NOT_FOUND":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NO_ACTIVE_SESSION")
    elif status_msg == "SESSION_NOT_IN_PROGRESS":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SESSION_NOT_IN_PROGRESS")
        
    sess = SessionRepository.get_session_by_id(db, session_id)
    if sess.student_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="FORBIDDEN")
        
    formatted_qs = []
    for q in state["questions"]:
        formatted_qs.append({
            "id": q.id,
            "body": q.body,
            "option_a": q.option_a,
            "option_b": q.option_b,
            "option_c": q.option_c,
            "option_d": q.option_d,
            "difficulty": q.difficulty,
            "topic_id": q.topic_id,
            "subject": q.topic.subject if q.topic else "reading"
        })
        
    return {
        "current_question_no": state["current_question_no"],
        "total_questions": state["total_questions"],
        "time_remaining": state["time_remaining"],
        "answers": state["answers"],
        "flagged": state["flagged"],
        "questions": formatted_qs
    }

@router.get("/sessions/{session_id}/review")
def get_session_review(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sess = SessionRepository.get_session_by_id(db, session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="SESSION_NOT_FOUND")
    if sess.status != "completed":
        raise HTTPException(status_code=400, detail="SESSION_NOT_COMPLETED")

    if current_user.role == "student" and sess.student_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="FORBIDDEN")
    elif current_user.role == "counsellor":
        profile = sess.student.profile
        if not profile or profile.counsellor_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="FORBIDDEN")

    answers = SessionRepository.get_session_answers(db, session_id)
    review_data = []
    for ans in answers:
        q = QuestionRepository.get_question_by_id(db, ans.question_id)
        if q:
            fallback_misconceptions = {
                "Information & Ideas": "Misinterpreting text evidence or over-generalizing details.",
                "Craft & Structure": "Conflating tone with character intent or vocabulary definitions.",
                "Expression of Ideas": "Using redundant transitional words or incorrect rhetorical structures.",
                "Standard English Conventions": "Misidentifying comma splices or pronoun-antecedent agreement.",
                "Algebra": "Making sign errors when multiplying/dividing by a negative number.",
                "Advanced Math": "Incorrectly factoring quadratics or misapplying exponent rules.",
                "Problem Solving & Data Analysis": "Confusing ratios with percentages or misinterpreting standard deviations.",
                "Geometry & Trigonometry": "Using incorrect trigonometric ratios (SOH CAH TOA) or area formulas."
            }
            domain = q.topic.skill_domain if q.topic else "Algebra"
            misconception = q.common_misconception or fallback_misconceptions.get(domain, "Forgetting to review intermediate algebraic steps.")
            related = q.related_concept or f"{domain} and Equation Calibration"
            
            review_data.append({
                "question_id": q.id,
                "body": q.body,
                "option_a": q.option_a,
                "option_b": q.option_b,
                "option_c": q.option_c,
                "option_d": q.option_d,
                "correct_option": q.correct_option,
                "selected_option": ans.selected_option,
                "is_correct": ans.is_correct,
                "is_flagged": ans.is_flagged,
                "time_taken_seconds": ans.time_taken_seconds,
                "explanation": q.explanation,
                "topic_name": q.topic.name if q.topic else "General",
                "subject": q.topic.subject if q.topic else "math",
                "module_no": ans.module_no,
                "mistake_type": ans.mistake_type,
                "common_misconception": misconception,
                "related_concept": related,
                "difficulty": q.difficulty,
                "difficulty_score": q.difficulty_score or 55,
                "estimated_mastery": 68 if ans.is_correct else 35,
                "suggested_next_practice": f"Review {domain} revision guide and practice 10 questions"
            })
    return review_data

from pydantic import BaseModel
class MistakeTypeInput(BaseModel):
    mistake_type: str

@router.post("/sessions/{session_id}/questions/{question_id}/mistake")
def update_mistake_type(
    session_id: str,
    question_id: str,
    data: MistakeTypeInput,
    current_user: User = Depends(require_role(["student"])),
    db: Session = Depends(get_db)
):
    from sqlalchemy import and_
    ans = db.query(SessionAnswer).filter(and_(
        SessionAnswer.session_id == session_id,
        SessionAnswer.question_id == question_id
    )).first()
    if not ans:
        raise HTTPException(status_code=404, detail="Answer not found")
        
    ans.mistake_type = data.mistake_type
    db.commit()
    return {"updated": True, "mistake_type": data.mistake_type}
