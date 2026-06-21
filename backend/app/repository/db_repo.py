from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from app.models.models import User, StudentProfile, Topic, Question, Test, TestModule, ModuleQuestion, TestSession, SessionAnswer, TestScore, Recommendation, Event
from typing import List, Optional, Dict, Any
from datetime import datetime

class UserRepository:
    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email).first()

    @staticmethod
    def get_by_id(db: Session, user_id: str) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def create_user(db: Session, email: str, password_hash: str, role: str, full_name: Optional[str] = None) -> User:
        user = User(email=email, password_hash=password_hash, role=role, full_name=full_name)
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Create student profile if the role is student
        if role == "student":
            profile = StudentProfile(user_id=user.id)
            db.add(profile)
            db.commit()
            db.refresh(user)
        return user

    @staticmethod
    def list_users(db: Session, role: Optional[str] = None, search: Optional[str] = None, page: int = 1, limit: int = 50) -> List[User]:
        query = db.query(User)
        if role:
            query = query.filter(User.role == role)
        if search:
            query = query.filter(User.email.contains(search) | User.full_name.contains(search))
        offset = (page - 1) * limit
        return query.offset(offset).limit(limit).all()

    @staticmethod
    def count_users(db: Session, role: Optional[str] = None, search: Optional[str] = None) -> int:
        query = db.query(User)
        if role:
            query = query.filter(User.role == role)
        if search:
            query = query.filter(User.email.contains(search) | User.full_name.contains(search))
        return query.count()

class TestRepository:
    @staticmethod
    def list_active_tests(db: Session) -> List[Test]:
        return db.query(Test).filter(Test.is_active == True).all()

    @staticmethod
    def get_test_by_id(db: Session, test_id: str) -> Optional[Test]:
        return db.query(Test).filter(Test.id == test_id).first()

    @staticmethod
    def get_modules_by_test(db: Session, test_id: str) -> List[TestModule]:
        return db.query(TestModule).filter(TestModule.test_id == test_id).order_by(TestModule.module_no).all()

    @staticmethod
    def get_module_by_test_and_no(db: Session, test_id: str, module_no: int) -> Optional[TestModule]:
        return db.query(TestModule).filter(and_(TestModule.test_id == test_id, TestModule.module_no == module_no)).first()

    @staticmethod
    def get_module_by_test_no_subject_difficulty(db: Session, test_id: str, module_no: int, subject: str, difficulty: str) -> Optional[TestModule]:
        return db.query(TestModule).filter(and_(
            TestModule.test_id == test_id,
            TestModule.module_no == module_no,
            TestModule.subject == subject,
            TestModule.difficulty == difficulty
        )).first()

class QuestionRepository:
    @staticmethod
    def get_questions_for_module(db: Session, module_id: str) -> List[Question]:
        return db.query(Question)\
            .join(ModuleQuestion, ModuleQuestion.question_id == Question.id)\
            .filter(ModuleQuestion.module_id == module_id)\
            .order_by(ModuleQuestion.display_order)\
            .all()

    @staticmethod
    def get_question_by_id(db: Session, q_id: str) -> Optional[Question]:
        return db.query(Question).filter(Question.id == q_id).first()

    @staticmethod
    def get_all_topics(db: Session) -> List[Topic]:
        return db.query(Topic).all()

    @staticmethod
    def get_topic_by_id(db: Session, topic_id: str) -> Optional[Topic]:
        return db.query(Topic).filter(Topic.id == topic_id).first()

    @staticmethod
    def get_topic_by_name(db: Session, name: str) -> Optional[Topic]:
        return db.query(Topic).filter(Topic.name == name).first()

    @staticmethod
    def create_question(db: Session, data: dict) -> Question:
        q = Question(**data)
        db.add(q)
        db.commit()
        db.refresh(q)
        return q

    @staticmethod
    def approve_question(db: Session, question_id: str) -> Optional[Question]:
        q = db.query(Question).filter(Question.id == question_id).first()
        if q:
            q.is_approved = True
            db.commit()
            db.refresh(q)
        return q

class SessionRepository:
    @staticmethod
    def get_active_session(db: Session, student_id: str, test_id: str) -> Optional[TestSession]:
        return db.query(TestSession).filter(and_(
            TestSession.student_id == student_id,
            TestSession.test_id == test_id,
            TestSession.status == "in_progress"
        )).first()

    @staticmethod
    def get_session_by_id(db: Session, session_id: str) -> Optional[TestSession]:
        return db.query(TestSession).filter(TestSession.id == session_id).first()

    @staticmethod
    def create_session(db: Session, student_id: str, test_id: str) -> TestSession:
        sess = TestSession(student_id=student_id, test_id=test_id, status="in_progress", current_module=1)
        db.add(sess)
        db.commit()
        db.refresh(sess)
        return sess

    @staticmethod
    def save_answers(db: Session, session_id: str, module_no: int, answers: Dict[str, str], flagged: List[str]) -> None:
        # Resolve all question_ids in current answers
        # Clean current flags for this session and module
        db.query(SessionAnswer).filter(and_(
            SessionAnswer.session_id == session_id,
            SessionAnswer.module_no == module_no
        )).update({SessionAnswer.is_flagged: False})
        
        # Save answers
        for q_id, val in answers.items():
            ans = db.query(SessionAnswer).filter(and_(
                SessionAnswer.session_id == session_id,
                SessionAnswer.question_id == q_id
            )).first()
            
            q = db.query(Question).filter(Question.id == q_id).first()
            is_correct = None
            if q:
                # Case insensitive check for open ended math (SPR)
                is_correct = (str(val).strip().upper() == str(q.correct_option).strip().upper())

            if ans:
                ans.selected_option = val
                ans.is_correct = is_correct
                ans.answered_at = datetime.utcnow()
            else:
                ans = SessionAnswer(
                    session_id=session_id,
                    question_id=q_id,
                    module_no=module_no,
                    selected_option=val,
                    is_correct=is_correct,
                    answered_at=datetime.utcnow()
                )
                db.add(ans)
        
        # Mark flagged
        for q_id in flagged:
            ans = db.query(SessionAnswer).filter(and_(
                SessionAnswer.session_id == session_id,
                SessionAnswer.question_id == q_id
            )).first()
            if ans:
                ans.is_flagged = True
            else:
                ans = SessionAnswer(
                    session_id=session_id,
                    question_id=q_id,
                    module_no=module_no,
                    is_flagged=True
                )
                db.add(ans)
        
        db.commit()

    @staticmethod
    def get_session_answers(db: Session, session_id: str) -> List[SessionAnswer]:
        return db.query(SessionAnswer).filter(SessionAnswer.session_id == session_id).all()

    @staticmethod
    def get_session_answers_for_module(db: Session, session_id: str, module_no: int) -> List[SessionAnswer]:
        return db.query(SessionAnswer).filter(and_(
            SessionAnswer.session_id == session_id,
            SessionAnswer.module_no == module_no
        )).all()

class ScoreRepository:
    @staticmethod
    def get_score_by_session(db: Session, session_id: str) -> Optional[TestScore]:
        return db.query(TestScore).filter(TestScore.session_id == session_id).first()

    @staticmethod
    def save_score(db: Session, session_id: str, reading_raw: int, reading_scaled: int, math_raw: int, math_scaled: int, total_score: int, band_low: int, band_high: int, skill_breakdown: dict) -> TestScore:
        score = db.query(TestScore).filter(TestScore.session_id == session_id).first()
        if not score:
            score = TestScore(
                session_id=session_id,
                reading_raw=reading_raw,
                reading_scaled=reading_scaled,
                math_raw=math_raw,
                math_scaled=math_scaled,
                total_score=total_score,
                band_low=band_low,
                band_high=band_high,
                skill_breakdown=skill_breakdown
            )
            db.add(score)
        else:
            score.reading_raw = reading_raw
            score.reading_scaled = reading_scaled
            score.math_raw = math_raw
            score.math_scaled = math_scaled
            score.total_score = total_score
            score.band_low = band_low
            score.band_high = band_high
            score.skill_breakdown = skill_breakdown
            score.calculated_at = datetime.utcnow()
        db.commit()
        db.refresh(score)
        return score

class RecommendationRepository:
    @staticmethod
    def get_by_student(db: Session, student_id: str) -> List[Recommendation]:
        return db.query(Recommendation).filter(and_(
            Recommendation.student_id == student_id,
            Recommendation.is_dismissed == False
        )).order_by(desc(Recommendation.generated_at)).all()

    @staticmethod
    def dismiss(db: Session, rec_id: str, student_id: str) -> bool:
        rec = db.query(Recommendation).filter(and_(
            Recommendation.id == rec_id,
            Recommendation.student_id == student_id
        )).first()
        if rec:
            rec.is_dismissed = True
            db.commit()
            return True
        return False

    @staticmethod
    def create_recommendation(db: Session, student_id: str, session_id: Optional[str], rec_type: str, content: dict) -> Recommendation:
        rec = Recommendation(student_id=student_id, session_id=session_id, type=rec_type, content=content)
        db.add(rec)
        db.commit()
        db.refresh(rec)
        return rec

class EventRepository:
    @staticmethod
    def log_event(db: Session, event_name: str, user_id: Optional[str] = None, session_id: Optional[str] = None, properties: Optional[dict] = None) -> Event:
        evt = Event(event_name=event_name, user_id=user_id, session_id=session_id, properties=properties)
        db.add(evt)
        db.commit()
        db.refresh(evt)
        return evt
