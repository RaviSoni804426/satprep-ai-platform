from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.schemas import QuestionOut, QuestionCreate, RosterStudentOut
from app.routers.deps import require_role
from app.models.models import User, Question, Topic, StudentProfile, TestScore, TestSession
from app.repository.db_repo import QuestionRepository, UserRepository
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import csv
import io
from datetime import datetime

router = APIRouter(tags=["Admin & Counsellor"])

@router.post("/admin/questions", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
def create_question(
    data: QuestionCreate,
    current_user: User = Depends(require_role(["author", "admin"])),
    db: Session = Depends(get_db)
):
    q_data = data.model_dump()
    q_data["created_by"] = current_user.id
    # Admins can auto-approve their own questions, authors start as unapproved draft
    q_data["is_approved"] = (current_user.role == "admin")
    
    q = QuestionRepository.create_question(db, q_data)
    return q

@router.patch("/admin/questions/{question_id}/approve")
def approve_question(
    question_id: str,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    q = QuestionRepository.approve_question(db, question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"is_approved": q.is_approved}

@router.get("/admin/questions", response_model=List[QuestionOut])
def list_questions(
    current_user: User = Depends(require_role(["author", "admin"])),
    db: Session = Depends(get_db)
):
    # Retrieve all questions
    return db.query(Question).all()

@router.post("/admin/questions/import")
def import_questions(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(["author", "admin"])),
    db: Session = Depends(get_db)
):
    content = file.file.read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(content))
    
    imported_count = 0
    for row in reader:
        # Check required columns
        body = row.get("body")
        correct_option = row.get("correct_option")
        difficulty = row.get("difficulty", "medium")
        topic_name = row.get("topic_name", "General")
        subject = row.get("subject", "math")
        skill_domain = row.get("skill_domain", "Algebra")
        
        if not body or not correct_option:
            continue
            
        # Get or create Topic
        topic = db.query(Topic).filter(Topic.name == topic_name).first()
        if not topic:
            topic = Topic(name=topic_name, subject=subject, skill_domain=skill_domain)
            db.add(topic)
            db.commit()
            db.refresh(topic)
            
        q_data = {
            "body": body,
            "option_a": row.get("option_a"),
            "option_b": row.get("option_b"),
            "option_c": row.get("option_c"),
            "option_d": row.get("option_d"),
            "correct_option": correct_option,
            "explanation": row.get("explanation"),
            "difficulty": difficulty,
            "topic_id": topic.id,
            "created_by": current_user.id,
            "is_approved": (current_user.role == "admin")
        }
        
        QuestionRepository.create_question(db, q_data)
        imported_count += 1
        
    return {"imported": imported_count}

@router.get("/admin/reports/export")
def export_reports(
    type: str = "scores",  # 'scores' | 'users' | 'completion'
    current_user: User = Depends(require_role(["counsellor", "admin"])),
    db: Session = Depends(get_db)
):
    output = io.StringIO()
    writer = csv.writer(output)
    
    if type == "scores":
        writer.writerow(["Student Email", "Test Name", "Reading Scaled", "Math Scaled", "Total Score", "Calculated At"])
        scores = db.query(TestScore).all()
        for s in scores:
            student_email = s.session.student.email if s.session else "Unknown"
            test_name = s.session.test.name if s.session else "Unknown"
            writer.writerow([student_email, test_name, s.reading_scaled, s.math_scaled, s.total_score, s.calculated_at.isoformat()])
    elif type == "users":
        writer.writerow(["Email", "Role", "Full Name", "Is Active", "Created At"])
        users = db.query(User).all()
        for u in users:
            writer.writerow([u.email, u.role, u.full_name or "", u.is_active, u.created_at.isoformat()])
    elif type == "completion":
        writer.writerow(["Student Email", "Test Name", "Status", "Started At", "Completed At"])
        sessions = db.query(TestSession).all()
        for s in sessions:
            writer.writerow([s.student.email, s.test.name, s.status, s.started_at.isoformat(), s.completed_at.isoformat() if s.completed_at else ""])
            
    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={type}_report.csv"}
    )

@router.get("/counsellor/students", response_model=List[RosterStudentOut])
def get_counsellor_students(
    current_user: User = Depends(require_role(["counsellor", "admin"])),
    db: Session = Depends(get_db)
):
    # If admin, fetch all students; if counsellor, only assigned students
    if current_user.role == "admin":
        profiles = db.query(StudentProfile).all()
    else:
        profiles = db.query(StudentProfile).filter(StudentProfile.counsellor_id == current_user.id).all()
        
    data = []
    for p in profiles:
        student = p.user
        
        # Get all completed scores for trend
        scores = db.query(TestScore)\
            .join(TestScore.session)\
            .filter(TestSession.student_id == student.id)\
            .order_by(TestScore.calculated_at)\
            .all()
            
        trend_scores = [s.total_score for s in scores]
        latest_score = trend_scores[-1] if trend_scores else None
        best_score = max(trend_scores) if trend_scores else None
        
        # Trend status
        trend = "stable"
        if len(trend_scores) >= 2:
            if trend_scores[-1] > trend_scores[-2]:
                trend = "up"
            elif trend_scores[-1] < trend_scores[-2]:
                trend = "down"
                
        # Readiness calculation
        status_label = "Needs Work"
        target = p.target_score or 1400
        if latest_score is not None:
            gap = target - latest_score
            recent_delta = trend_scores[-1] - trend_scores[-2] if len(trend_scores) >= 2 else 0
            
            if gap <= 0:
                status_label = "Ready"
            elif gap <= 100 and recent_delta >= 0:
                status_label = "Almost Ready"
            else:
                status_label = "Needs Work"
                
        data.append({
            "id": student.id,
            "full_name": student.full_name or student.email,
            "latest_score": latest_score,
            "best_score": best_score,
            "trend": trend,
            "status": status_label
        })
        
    return data

# --- Admin Approval Dashboard Operations ---

class UserApproveRequest(BaseModel):
    notes: Optional[str] = None

class UserRejectRequest(BaseModel):
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None

class UserSuspendRequest(BaseModel):
    notes: Optional[str] = None

class UserReactivateRequest(BaseModel):
    notes: Optional[str] = None

class UserRoleUpdateRequest(BaseModel):
    role: str = Field(..., pattern="^(student|counsellor|author|admin)$")

@router.post("/admin/users/{user_id}/approve")
def approve_user(
    user_id: str,
    data: UserApproveRequest,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    user = UserRepository.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.approval_status = "Approved"
    user.is_active = True
    user.approved_by = current_user.id
    user.approval_date = datetime.utcnow()
    user.approval_notes = data.notes
    db.commit()
    
    # Send welcome email
    from app.services.email_service import EmailService
    EmailService.send_user_approved_email(user)
    
    return {"message": "User approved successfully", "approval_status": "Approved"}

@router.post("/admin/users/{user_id}/reject")
def reject_user(
    user_id: str,
    data: UserRejectRequest,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    user = UserRepository.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.approval_status = "Rejected"
    user.approved_by = current_user.id
    user.approval_date = datetime.utcnow()
    user.rejection_reason = data.rejection_reason
    user.approval_notes = data.notes
    db.commit()
    
    # Send rejection email
    from app.services.email_service import EmailService
    EmailService.send_user_rejected_email(user, reason=data.rejection_reason)
    
    return {"message": "User registration request rejected", "approval_status": "Rejected"}

@router.post("/admin/users/{user_id}/suspend")
def suspend_user(
    user_id: str,
    data: UserSuspendRequest,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    user = UserRepository.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.approval_status = "Suspended"
    user.is_active = False
    user.approved_by = current_user.id
    user.approval_date = datetime.utcnow()
    user.approval_notes = data.notes
    db.commit()
    
    return {"message": "User account suspended", "approval_status": "Suspended"}

@router.post("/admin/users/{user_id}/reactivate")
def reactivate_user(
    user_id: str,
    data: UserReactivateRequest,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    user = UserRepository.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.approval_status = "Approved"
    user.is_active = True
    user.approved_by = current_user.id
    user.approval_date = datetime.utcnow()
    user.approval_notes = data.notes
    db.commit()
    
    # Send approved email
    from app.services.email_service import EmailService
    EmailService.send_user_approved_email(user)
    
    return {"message": "User account reactivated", "approval_status": "Approved"}

@router.patch("/admin/users/{user_id}/role")
def update_user_role(
    user_id: str,
    data: UserRoleUpdateRequest,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    user = UserRepository.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.role = data.role
    db.commit()
    
    return {"message": "User role updated successfully", "role": user.role}
