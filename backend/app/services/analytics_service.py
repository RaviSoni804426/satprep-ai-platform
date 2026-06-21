from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, func
from app.models.models import TestSession, TestScore, SessionAnswer, Question, Topic, User, Event
from app.services.recommendation_service import RecommendationService
from app.repository.db_repo import QuestionRepository
from datetime import datetime, timedelta

class AnalyticsService:
    @staticmethod
    def get_student_analytics(db: Session, student_id: str) -> dict:
        # Fetch all completed sessions for this student
        sessions = db.query(TestSession).filter(and_(
            TestSession.student_id == student_id,
            TestSession.status == "completed"
        )).all()
        
        total_mocks = len(sessions)
        if total_mocks == 0:
            return {
                "total_mocks": 0,
                "avg_score": 0,
                "best_score": 0,
                "score_trend": [],
                "accuracy": {"reading": 0, "math": 0},
                "weak_topics": [],
                "avg_time_per_question_seconds": 0
            }
            
        session_ids = [s.id for s in sessions]
        scores = db.query(TestScore).filter(TestScore.session_id.in_(session_ids)).order_by(TestScore.calculated_at).all()
        
        total_scores = [s.total_score for s in scores]
        avg_score = int(sum(total_scores) / len(total_scores)) if total_scores else 0
        best_score = max(total_scores) if total_scores else 0
        score_trend = total_scores
        
        # Calculate section accuracy
        answers = db.query(SessionAnswer).filter(SessionAnswer.session_id.in_(session_ids)).all()
        
        reading_correct = sum(1 for a in answers if a.module_no in (1, 2) and a.is_correct is True)
        reading_total = sum(1 for a in answers if a.module_no in (1, 2) and a.selected_option is not None)
        math_correct = sum(1 for a in answers if a.module_no in (3, 4) and a.is_correct is True)
        math_total = sum(1 for a in answers if a.module_no in (3, 4) and a.selected_option is not None)
        
        accuracy = {
            "reading": int((reading_correct / reading_total) * 100) if reading_total > 0 else 0,
            "math": int((math_correct / math_total) * 100) if math_total > 0 else 0
        }
        
        # Detect weak topics
        weak_topic_ids = RecommendationService.detect_weak_topics(db, student_id)
        weak_topics = []
        for t_id in weak_topic_ids[:3]:  # Cap at 3 for summary
            t = QuestionRepository.get_topic_by_id(db, t_id)
            if t:
                weak_topics.append(t.name)
                
        # Average time per question
        times = [a.time_taken_seconds for a in answers if a.time_taken_seconds is not None]
        avg_time = int(sum(times) / len(times)) if times else 60
        
        return {
            "total_mocks": total_mocks,
            "avg_score": avg_score,
            "best_score": best_score,
            "score_trend": score_trend,
            "accuracy": accuracy,
            "weak_topics": weak_topics,
            "avg_time_per_question_seconds": avg_time
        }

    @staticmethod
    def get_platform_analytics(db: Session) -> dict:
        total_tests_taken = db.query(TestSession).filter(TestSession.status == "completed").count()
        
        avg_score_row = db.query(func.avg(TestScore.total_score)).first()
        avg_platform_score = int(avg_score_row[0]) if avg_score_row and avg_score_row[0] else 1200
        
        started = db.query(TestSession).count()
        completed = total_tests_taken
        completion_rate = float(completed / started) if started > 0 else 0.0
        
        # Active students in 30 days
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        active_students = db.query(User.id)\
            .filter(and_(
                User.role == "student",
                User.is_active == True,
                User.created_at >= thirty_days_ago
            )).count()
            
        # Or count distinct user_ids in event logs
        event_active = db.query(Event.user_id)\
            .filter(Event.occurred_at >= thirty_days_ago)\
            .distinct().count()
            
        active_students_30d = max(active_students, event_active)
        
        return {
            "total_tests_taken": total_tests_taken,
            "avg_platform_score": avg_platform_score,
            "completion_rate": round(completion_rate, 2),
            "active_students_30d": active_students_30d
        }
