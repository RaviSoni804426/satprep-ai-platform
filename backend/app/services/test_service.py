import json
import logging
from sqlalchemy.orm import Session
from app.repository.db_repo import SessionRepository, TestRepository, QuestionRepository, EventRepository
from app.models.models import TestSession, TestModule, Question, SessionAnswer
from app.core.config import settings
import redis
from typing import Optional, Tuple, List, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

# Setup redis client
try:
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
except Exception as e:
    logger.error(f"Failed to connect to Redis in test_service: {e}")
    redis_client = None

class TestService:
    @staticmethod
    def get_redis_session_key(session_id: str) -> str:
        return f"session:{session_id}"

    @staticmethod
    def cache_session_state(session_id: str, state: dict) -> None:
        if redis_client:
            try:
                redis_client.setex(
                    TestService.get_redis_session_key(session_id),
                    7200,  # 2 hours expiry
                    json.dumps(state)
                )
            except Exception as e:
                logger.error(f"Redis session write error: {e}")

    @staticmethod
    def get_cached_session_state(session_id: str) -> Optional[dict]:
        if redis_client:
            try:
                data = redis_client.get(TestService.get_redis_session_key(session_id))
                if data:
                    return json.loads(data)
            except Exception as e:
                logger.error(f"Redis session read error: {e}")
        return None

    @staticmethod
    def delete_cached_session(session_id: str) -> None:
        if redis_client:
            try:
                redis_client.delete(TestService.get_redis_session_key(session_id))
            except Exception as e:
                logger.error(f"Redis session delete error: {e}")

    @staticmethod
    def start_session(db: Session, student_id: str, test_id: str) -> Tuple[Optional[TestSession], Optional[TestModule], List[Question], str]:
        # Check active session
        active = SessionRepository.get_active_session(db, student_id, test_id)
        if active:
            # Re-fetch module details to return active session details
            module = TestRepository.get_module_by_test_and_no(db, test_id, active.current_module)
            if not module:
                return None, None, [], "MODULE_NOT_FOUND"
            questions = QuestionRepository.get_questions_for_module(db, module.id)
            return active, module, questions, "ACTIVE_SESSION_EXISTS"
            
        test = TestRepository.get_test_by_id(db, test_id)
        if not test or not test.is_active:
            return None, None, [], "TEST_NOT_FOUND"
            
        # Module 1 (Reading, Standard) is always module_no = 1
        module = TestRepository.get_module_by_test_and_no(db, test_id, 1)
        if not module:
            return None, None, [], "MODULE_NOT_FOUND"
            
        sess = SessionRepository.create_session(db, student_id, test_id)
        questions = QuestionRepository.get_questions_for_module(db, module.id)
        
        # Cache initial session state in Redis
        state = {
            "student_id": student_id,
            "test_id": test_id,
            "current_module": 1,
            "answers": {},
            "flagged": [],
            "time_remaining": module.time_limit_seconds,
            "status": "in_progress"
        }
        TestService.cache_session_state(sess.id, state)
        
        EventRepository.log_event(db, "test.started", student_id, sess.id, {"test_id": test_id})
        
        return sess, module, questions, "SUCCESS"

    @staticmethod
    def autosave_answers(db: Session, session_id: str, answers: Dict[str, str], flagged: List[str], time_remaining: int) -> bool:
        sess = SessionRepository.get_session_by_id(db, session_id)
        if not sess or sess.status != "in_progress":
            return False
            
        # Update Redis Cache
        state = TestService.get_cached_session_state(session_id)
        if not state:
            state = {
                "student_id": sess.student_id,
                "test_id": sess.test_id,
                "current_module": sess.current_module,
                "answers": answers,
                "flagged": flagged,
                "time_remaining": time_remaining,
                "status": "in_progress"
            }
        else:
            state["answers"] = answers
            state["flagged"] = flagged
            state["time_remaining"] = time_remaining
            
        TestService.cache_session_state(session_id, state)
        
        # Save to DB
        SessionRepository.save_answers(db, session_id, sess.current_module, answers, flagged)
        return True

    @staticmethod
    def route_module2(module1_raw_score: int, total_questions: int, threshold_pct: float = 0.5) -> str:
        if total_questions == 0:
            return "easy"
        accuracy = module1_raw_score / total_questions
        return "hard" if accuracy >= threshold_pct else "easy"

    @staticmethod
    def submit_module(db: Session, session_id: str, module_no: int) -> Tuple[Optional[TestModule], List[Question], str]:
        sess = SessionRepository.get_session_by_id(db, session_id)
        if not sess or sess.status != "in_progress":
            return None, [], "SESSION_NOT_FOUND"
        if sess.current_module != module_no:
            return None, [], "MODULE_MISMATCH"
            
        # Sync latest Redis state to DB before routing if exists
        state = TestService.get_cached_session_state(session_id)
        if state:
            SessionRepository.save_answers(db, session_id, module_no, state.get("answers", {}), state.get("flagged", []))
            
        next_module = None
        questions = []
        
        # Get answers for module to calculate raw scores for routing decisions
        answers = SessionRepository.get_session_answers_for_module(db, session_id, module_no)
        correct_count = sum(1 for a in answers if a.is_correct is True)
        
        # Retrieve test routing threshold (we can support a dynamic threshold or static default of 50%)
        threshold_pct = 0.50
        
        if module_no == 1:
            # Submitting Reading Module 1 -> Route to Reading Module 2 (Easy or Hard)
            # Reading Module 1 has 27 questions
            difficulty = TestService.route_module2(correct_count, 27, threshold_pct)
            sess.module2_reading_difficulty = difficulty
            sess.current_module = 2
            db.commit()
            
            next_module = TestRepository.get_module_by_test_no_subject_difficulty(
                db, sess.test_id, 2, "reading", difficulty
            )
            
        elif module_no == 2:
            # Submitting Reading Module 2 -> Route to Math Module 1 (Standard)
            sess.current_module = 3
            db.commit()
            
            next_module = TestRepository.get_module_by_test_and_no(db, sess.test_id, 3)
            
        elif module_no == 3:
            # Submitting Math Module 1 -> Route to Math Module 2 (Easy or Hard)
            # Math Module 1 has 22 questions
            difficulty = TestService.route_module2(correct_count, 22, threshold_pct)
            sess.module2_math_difficulty = difficulty
            sess.current_module = 4
            db.commit()
            
            next_module = TestRepository.get_module_by_test_no_subject_difficulty(
                db, sess.test_id, 4, "math", difficulty
            )
            
        elif module_no == 4:
            # Final module completed -> Mark session as complete, score calculation is handled separately on final submit
            pass

        if next_module:
            questions = QuestionRepository.get_questions_for_module(db, next_module.id)
            # Update Redis cache with next module state
            new_state = {
                "student_id": sess.student_id,
                "test_id": sess.test_id,
                "current_module": sess.current_module,
                "answers": {},
                "flagged": [],
                "time_remaining": next_module.time_limit_seconds,
                "status": "in_progress"
            }
            TestService.cache_session_state(session_id, new_state)
            
            EventRepository.log_event(
                db, "test.module_submitted", sess.student_id, session_id,
                {"module_no": module_no, "raw_score": correct_count, "next_difficulty": next_module.difficulty}
            )
        
        return next_module, questions, "SUCCESS"

    @staticmethod
    def final_submit(db: Session, session_id: str) -> bool:
        sess = SessionRepository.get_session_by_id(db, session_id)
        if not sess or sess.status != "in_progress":
            return False
            
        # Sync latest Redis state to DB before completing
        state = TestService.get_cached_session_state(session_id)
        if state:
            SessionRepository.save_answers(db, session_id, sess.current_module, state.get("answers", {}), state.get("flagged", []))
            
        sess.status = "completed"
        sess.completed_at = datetime.utcnow()
        db.commit()
        
        # Clear cache
        TestService.delete_cached_session(session_id)
        
        EventRepository.log_event(db, "test.completed", sess.student_id, session_id)
        return True

    @staticmethod
    def resume_session(db: Session, session_id: str) -> Tuple[Optional[dict], str]:
        sess = SessionRepository.get_session_by_id(db, session_id)
        if not sess:
            return None, "SESSION_NOT_FOUND"
        if sess.status != "in_progress":
            return None, "SESSION_NOT_IN_PROGRESS"
            
        # Check cache
        state = TestService.get_cached_session_state(session_id)
        
        # If cache miss, reconstruct from DB
        if not state:
            module = TestRepository.get_module_by_test_and_no(db, sess.test_id, sess.current_module)
            if sess.current_module == 2:
                module = TestRepository.get_module_by_test_no_subject_difficulty(
                    db, sess.test_id, 2, "reading", sess.module2_reading_difficulty or "easy"
                )
            elif sess.current_module == 4:
                module = TestRepository.get_module_by_test_no_subject_difficulty(
                    db, sess.test_id, 4, "math", sess.module2_math_difficulty or "easy"
                )
                
            if not module:
                return None, "MODULE_NOT_FOUND"
                
            db_answers = SessionRepository.get_session_answers_for_module(db, session_id, sess.current_module)
            answers = {ans.question_id: ans.selected_option for ans in db_answers if ans.selected_option}
            flagged = [ans.question_id for ans in db_answers if ans.is_flagged]
            
            state = {
                "student_id": sess.student_id,
                "test_id": sess.test_id,
                "current_module": sess.current_module,
                "answers": answers,
                "flagged": flagged,
                "time_remaining": module.time_limit_seconds,
                "status": "in_progress"
            }
            TestService.cache_session_state(session_id, state)
            
        # Re-fetch current module questions to return
        module = TestRepository.get_module_by_test_and_no(db, sess.test_id, state["current_module"])
        if state["current_module"] == 2:
            module = TestRepository.get_module_by_test_no_subject_difficulty(
                db, sess.test_id, 2, "reading", sess.module2_reading_difficulty or "easy"
            )
        elif state["current_module"] == 4:
            module = TestRepository.get_module_by_test_no_subject_difficulty(
                db, sess.test_id, 4, "math", sess.module2_math_difficulty or "easy"
            )
            
        if not module:
            return None, "MODULE_NOT_FOUND"
            
        questions = QuestionRepository.get_questions_for_module(db, module.id)
        
        EventRepository.log_event(db, "test.resumed", sess.student_id, session_id, {"current_module": sess.current_module})
        
        return {
            "current_module": state["current_module"],
            "time_remaining": state["time_remaining"],
            "answers": state["answers"],
            "flagged": state["flagged"],
            "questions": questions
        }, "SUCCESS"
