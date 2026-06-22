import json
import logging
from sqlalchemy.orm import Session
from app.repository.db_repo import SessionRepository, TestRepository, QuestionRepository, EventRepository
from app.models.models import TestSession, Question, SessionAnswer, SystemSetting, AdaptiveLog
from app.services.adaptive_engine import AdaptiveEngine
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
    def start_session(db: Session, student_id: str, test_id: str) -> Tuple[Optional[TestSession], int, int, int, int, List[Question], str]:
        # Check active session
        active = SessionRepository.get_active_session(db, student_id, test_id)
        
        # Load configs
        config_entry = db.query(SystemSetting).filter(SystemSetting.key == "adaptive_config").first()
        adaptive_config = config_entry.value if config_entry else {
            "total_questions": 30,
            "time_limit_seconds": 2400,
            "initial_ability_score": 500,
            "min_difficulty": 1,
            "max_difficulty": 100,
            "adaptive_sensitivity": 1.0,
            "min_difficulty_change": 2,
            "max_difficulty_change": 15,
            "question_exposure_limit": 100
        }
        
        blueprint_entry = db.query(SystemSetting).filter(SystemSetting.key == "blueprint_config").first()
        blueprint_config = blueprint_entry.value if blueprint_entry else {
            "Information and Ideas": 4,
            "Craft and Structure": 4,
            "Expression of Ideas": 3,
            "Standard English Conventions": 3,
            "Linear Equations and Functions": 4,
            "Systems of Linear Equations": 3,
            "Quadratic and Exponential Functions": 3,
            "Ratios, Rates, and Proportions": 3,
            "Geometry and Trigonometry": 3
        }

        total_qs = adaptive_config.get("total_questions", 30)
        time_limit = adaptive_config.get("time_limit_seconds", 2400)
        init_ability = adaptive_config.get("initial_ability_score", 500)

        if active:
            # Reconstruct questions for active session
            served_ids = json.loads(active.questions_list) if active.questions_list else []
            questions = []
            for q_id in served_ids:
                q = QuestionRepository.get_question_by_id(db, q_id)
                if q:
                    questions.append(q)
            
            # Fetch cached time remaining
            time_remaining = time_limit
            state = TestService.get_cached_session_state(active.id)
            if state and "time_remaining" in state:
                time_remaining = state["time_remaining"]
                
            return active, active.current_question_no, total_qs, time_limit, time_remaining, questions, "ACTIVE_SESSION_EXISTS"

        test = TestRepository.get_test_by_id(db, test_id)
        if not test or not test.is_active:
            return None, 0, 0, 0, 0, [], "TEST_NOT_FOUND"

        # Create new session
        sess = TestSession(
            student_id=student_id,
            test_id=test_id,
            status="in_progress",
            current_module=1, # Default module_no for CAT
            ability_score=init_ability,
            ability_score_reading=init_ability,
            ability_score_math=init_ability,
            current_question_no=1,
            topic_counts=json.dumps({}),
            questions_list=json.dumps([])
        )
        db.add(sess)
        db.commit()
        db.refresh(sess)

        # Select the very first question
        first_q, reason = AdaptiveEngine.select_next_question(db, student_id, sess, adaptive_config, blueprint_config)
        
        # Update session
        sess.questions_list = json.dumps([first_q.id])
        topic_name = first_q.topic.name if first_q.topic else "General"
        sess.topic_counts = json.dumps({topic_name: 1})
        sess.current_question_no = 1
        db.commit()

        # Cache initial session state in Redis
        state = {
            "student_id": student_id,
            "test_id": test_id,
            "current_question_no": 1,
            "answers": {},
            "flagged": [],
            "time_remaining": time_limit,
            "status": "in_progress"
        }
        TestService.cache_session_state(sess.id, state)
        
        # Log first selection as log details
        first_log = AdaptiveLog(
            session_id=sess.id,
            question_id=first_q.id,
            question_number=1,
            ability_before=init_ability,
            ability_after=init_ability,
            question_difficulty=first_q.difficulty_score or 50,
            selection_reason=reason,
            topic_name=topic_name
        )
        db.add(first_log)
        db.commit()

        EventRepository.log_event(db, "test.started", student_id, sess.id, {"test_id": test_id})

        return sess, 1, total_qs, time_limit, time_limit, [first_q], "SUCCESS"

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
                "current_question_no": sess.current_question_no,
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
        
        # Save to DB (module_no = 1 for CAT engine)
        SessionRepository.save_answers(db, session_id, 1, answers, flagged)
        return True

    @staticmethod
    def submit_answer(
        db: Session, 
        session_id: str, 
        q_id: str, 
        selected_option: Optional[str], 
        time_taken_seconds: int, 
        is_flagged: bool, 
        time_remaining: int
    ) -> Tuple[str, Optional[Question], int, str]:
        """
        Processes answer submission for the current question and triggers adaptation.
        """
        sess = SessionRepository.get_session_by_id(db, session_id)
        if not sess or sess.status != "in_progress":
            return "SESSION_NOT_FOUND", None, 0, "SESSION_NOT_FOUND"

        # Save this answer in DB
        q = QuestionRepository.get_question_by_id(db, q_id)
        is_correct = None
        if q:
            is_correct = (str(selected_option).strip().upper() == str(q.correct_option).strip().upper()) if selected_option else False

        # Create or update SessionAnswer record
        ans = db.query(SessionAnswer).filter(
            SessionAnswer.session_id == session_id,
            SessionAnswer.question_id == q_id
        ).first()

        if ans:
            ans.selected_option = selected_option
            ans.is_correct = is_correct
            ans.is_flagged = is_flagged
            ans.time_taken_seconds = time_taken_seconds
            ans.answered_at = datetime.utcnow()
        else:
            ans = SessionAnswer(
                session_id=session_id,
                question_id=q_id,
                module_no=1, # CAT is 1 module
                selected_option=selected_option,
                is_correct=is_correct,
                is_flagged=is_flagged,
                time_taken_seconds=time_taken_seconds,
                answered_at=datetime.utcnow()
            )
            db.add(ans)
        db.commit()

        # Check if this question is the latest served (to prevent double adaptation on back navigation)
        served_ids = json.loads(sess.questions_list) if sess.questions_list else []
        if not served_ids or served_ids[-1] != q_id:
            # Student is just navigating/editing a previously generated question
            return "in_progress", None, sess.current_question_no, "NAVIGATIONAL_ANSWER"

        # Load configs
        config_entry = db.query(SystemSetting).filter(SystemSetting.key == "adaptive_config").first()
        adaptive_config = config_entry.value if config_entry else {
            "total_questions": 30,
            "adaptive_sensitivity": 1.0,
            "min_difficulty_change": 2,
            "max_difficulty_change": 15
        }
        
        blueprint_entry = db.query(SystemSetting).filter(SystemSetting.key == "blueprint_config").first()
        blueprint_config = blueprint_entry.value if blueprint_entry else {}

        # Run psychometric update on Ability Score
        q_topic = q.topic.name if q and q.topic else "General"
        subject = q.topic.subject if q and q.topic else "math"
        diff_score = q.difficulty_score or 50

        if subject == "reading":
            old_ability = sess.ability_score_reading
            new_ability = AdaptiveEngine.update_ability(
                old_ability, diff_score, is_correct,
                adaptive_config.get("adaptive_sensitivity", 1.0),
                adaptive_config.get("min_difficulty_change", 2),
                adaptive_config.get("max_difficulty_change", 15)
            )
            sess.ability_score_reading = new_ability
        else:
            old_ability = sess.ability_score_math
            new_ability = AdaptiveEngine.update_ability(
                old_ability, diff_score, is_correct,
                adaptive_config.get("adaptive_sensitivity", 1.0),
                adaptive_config.get("min_difficulty_change", 2),
                adaptive_config.get("max_difficulty_change", 15)
            )
            sess.ability_score_math = new_ability

        # Average ability
        sess.ability_score = int((sess.ability_score_reading + sess.ability_score_math) / 2.0)
        
        # Log this decision update in DB
        log_entry = db.query(AdaptiveLog).filter(
            AdaptiveLog.session_id == session_id,
            AdaptiveLog.question_id == q_id
        ).first()

        if log_entry:
            log_entry.ability_before = old_ability
            log_entry.ability_after = new_ability
            log_entry.is_correct = is_correct
            log_entry.time_taken_seconds = time_taken_seconds
        else:
            log_entry = AdaptiveLog(
                session_id=session_id,
                question_id=q_id,
                question_number=len(served_ids),
                ability_before=old_ability,
                ability_after=new_ability,
                question_difficulty=diff_score,
                is_correct=is_correct,
                time_taken_seconds=time_taken_seconds,
                topic_name=q_topic
            )
            db.add(log_entry)
        db.commit()

        # Check if the exam has reached the question limit
        total_questions_limit = adaptive_config.get("total_questions", 30)
        if len(served_ids) >= total_questions_limit:
            # End exam
            sess.status = "completed"
            sess.completed_at = datetime.utcnow()
            db.commit()
            
            # Clear Redis Cache
            TestService.delete_cached_session(session_id)
            
            EventRepository.log_event(db, "test.completed", sess.student_id, session_id)
            return "completed", None, len(served_ids), "SUCCESS"

        # Select the NEXT question using CAT engine
        next_q, select_reason = AdaptiveEngine.select_next_question(db, sess.student_id, sess, adaptive_config, blueprint_config)

        # Update served lists
        served_ids.append(next_q.id)
        sess.questions_list = json.dumps(served_ids)
        
        # Update topic counts
        next_topic_name = next_q.topic.name if next_q.topic else "General"
        served_counts = json.loads(sess.topic_counts) if sess.topic_counts else {}
        served_counts[next_topic_name] = served_counts.get(next_topic_name, 0) + 1
        sess.topic_counts = json.dumps(served_counts)
        
        # Increment active question number
        sess.current_question_no = len(served_ids)
        db.commit()

        # Log selection reason for the next question
        next_log = AdaptiveLog(
            session_id=session_id,
            question_id=next_q.id,
            question_number=len(served_ids),
            ability_before=new_ability,
            ability_after=new_ability,
            question_difficulty=next_q.difficulty_score or 50,
            selection_reason=select_reason,
            topic_name=next_topic_name
        )
        db.add(next_log)
        db.commit()

        # Sync Redis cache
        db_answers = SessionRepository.get_session_answers(db, session_id)
        answers_map = {ans.question_id: ans.selected_option for ans in db_answers if ans.selected_option}
        flagged_list = [ans.question_id for ans in db_answers if ans.is_flagged]
        
        state = {
            "student_id": sess.student_id,
            "test_id": sess.test_id,
            "current_question_no": sess.current_question_no,
            "answers": answers_map,
            "flagged": flagged_list,
            "time_remaining": time_remaining,
            "status": "in_progress"
        }
        TestService.cache_session_state(session_id, state)

        return "in_progress", next_q, sess.current_question_no, "SUCCESS"

    @staticmethod
    def final_submit(db: Session, session_id: str) -> bool:
        sess = SessionRepository.get_session_by_id(db, session_id)
        if not sess or sess.status != "in_progress":
            return False
            
        # Sync latest Redis state to DB before completing
        state = TestService.get_cached_session_state(session_id)
        if state:
            SessionRepository.save_answers(db, session_id, 1, state.get("answers", {}), state.get("flagged", []))
            
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
            
        served_ids = json.loads(sess.questions_list) if sess.questions_list else []
        questions = []
        for q_id in served_ids:
            q = QuestionRepository.get_question_by_id(db, q_id)
            if q:
                questions.append(q)

        db_answers = SessionRepository.get_session_answers(db, session_id)
        answers = {ans.question_id: ans.selected_option for ans in db_answers if ans.selected_option}
        flagged = [ans.question_id for ans in db_answers if ans.is_flagged]

        # Load configs for totals
        config_entry = db.query(SystemSetting).filter(SystemSetting.key == "adaptive_config").first()
        total_qs = config_entry.value.get("total_questions", 30) if config_entry else 30
        time_limit = config_entry.value.get("time_limit_seconds", 2400) if config_entry else 2400

        time_remaining = time_limit
        state = TestService.get_cached_session_state(session_id)
        if state and "time_remaining" in state:
            time_remaining = state["time_remaining"]

        EventRepository.log_event(db, "test.resumed", sess.student_id, session_id, {"current_question_no": sess.current_question_no})

        return {
            "current_question_no": sess.current_question_no,
            "total_questions": total_qs,
            "time_remaining": time_remaining,
            "answers": answers,
            "flagged": flagged,
            "questions": questions
        }, "SUCCESS"
