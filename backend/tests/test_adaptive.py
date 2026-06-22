import pytest
import json
from app.models.models import User, StudentProfile, Topic, Question, Test, TestSession, SessionAnswer, SystemSetting, AdaptiveLog
from app.services.test_service import TestService
from app.services.adaptive_engine import AdaptiveEngine
from app.services.scoring_service import ScoringService

def test_adaptive_flow(db):
    # 1. Seed System Settings
    adaptive_config = SystemSetting(
        key="adaptive_config",
        value={
            "total_questions": 5, # Low limit for quick test
            "time_limit_seconds": 1200,
            "initial_ability_score": 500,
            "min_difficulty": 1,
            "max_difficulty": 100,
            "adaptive_sensitivity": 1.0,
            "min_difficulty_change": 2,
            "max_difficulty_change": 15,
            "question_exposure_limit": 100
        },
        description="Global Computerized Adaptive Testing (CAT) parameters"
    )
    blueprint_config = SystemSetting(
        key="blueprint_config",
        value={
            "Information and Ideas": 2,
            "Craft and Structure": 1,
            "Linear Equations and Functions": 2
        },
        description="Target distribution"
    )
    db.add_all([adaptive_config, blueprint_config])
    db.commit()

    # 2. Seed student and profile
    student = User(
        email="cat_student@example.com",
        password_hash="hash",
        role="student",
        is_verified=True,
        approval_status="Approved"
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    profile = StudentProfile(user_id=student.id, target_score=1500)
    db.add(profile)
    db.commit()

    # 3. Seed Topics
    topics_data = [
        {"name": "Information and Ideas", "subject": "reading", "skill_domain": "Information & Ideas"},
        {"name": "Craft and Structure", "subject": "reading", "skill_domain": "Craft & Structure"},
        {"name": "Linear Equations and Functions", "subject": "math", "skill_domain": "Algebra"}
    ]
    topics = {}
    for t_data in topics_data:
        t = Topic(name=t_data["name"], subject=t_data["subject"], skill_domain=t_data["skill_domain"])
        db.add(t)
        db.commit()
        db.refresh(t)
        topics[t_data["name"]] = t

    # 4. Seed Questions (Easy, Medium, Hard for each topic)
    for topic_name, t_obj in topics.items():
        # Easy question
        q_easy = Question(
            body=f"Easy question on {topic_name}",
            option_a="A", option_b="B", option_c="C", option_d="D",
            correct_option="A", difficulty="easy", difficulty_score=25,
            topic_id=t_obj.id, is_approved=True
        )
        # Medium question
        q_med = Question(
            body=f"Medium question on {topic_name}",
            option_a="A", option_b="B", option_c="C", option_d="D",
            correct_option="B", difficulty="medium", difficulty_score=50,
            topic_id=t_obj.id, is_approved=True
        )
        # Hard question
        q_hard = Question(
            body=f"Hard question on {topic_name}",
            option_a="A", option_b="B", option_c="C", option_d="D",
            correct_option="C", difficulty="hard", difficulty_score=75,
            topic_id=t_obj.id, is_approved=True
        )
        db.add_all([q_easy, q_med, q_hard])
    db.commit()

    # 5. Seed Test
    test = Test(name="Adaptive Test #1", description="CAT Mock Test", is_active=True)
    db.add(test)
    db.commit()
    db.refresh(test)

    # 6. Start test session
    sess, q_no, total_qs, time_limit, time_remaining, questions, msg = TestService.start_session(db, student.id, test.id)
    assert msg == "SUCCESS"
    assert sess.current_question_no == 1
    assert sess.ability_score == 500
    assert len(questions) == 1
    first_q = questions[0]
    
    # 7. Submit first answer (Incorrect answer)
    status_msg, next_q, q_no, code = TestService.submit_answer(
        db, sess.id, first_q.id, "D", 20, False, time_remaining - 20
    )
    assert code == "SUCCESS"
    assert status_msg == "in_progress"
    assert q_no == 2
    assert next_q is not None

    # Check ability update: incorrect answer should drop ability score for that subject
    db.refresh(sess)
    first_q_subject = first_q.topic.subject
    if first_q_subject == "reading":
        assert sess.ability_score_reading < 500
    else:
        assert sess.ability_score_math < 500

    # 8. Submit second answer (Correct answer)
    old_ability = sess.ability_score
    status_msg, next_q3, q_no, code = TestService.submit_answer(
        db, sess.id, next_q.id, next_q.correct_option, 15, False, time_remaining - 35
    )
    db.refresh(sess)
    assert sess.ability_score > old_ability  # Correct answer should raise ability score
    
    # Let's answer the remaining questions to complete the 5 question limit
    # Question 3
    assert q_no == 3
    status_msg, next_q4, q_no, code = TestService.submit_answer(
        db, sess.id, next_q3.id, next_q3.correct_option, 10, False, time_remaining - 45
    )
    # Question 4
    assert q_no == 4
    status_msg, next_q5, q_no, code = TestService.submit_answer(
        db, sess.id, next_q4.id, next_q4.correct_option, 10, False, time_remaining - 55
    )
    # Question 5
    assert q_no == 5
    status_msg, next_q_none, q_no, code = TestService.submit_answer(
        db, sess.id, next_q5.id, next_q5.correct_option, 10, False, time_remaining - 65
    )
    
    # The 5th submission should end the session
    db.refresh(sess)
    assert status_msg == "completed"
    assert sess.status == "completed"
    assert next_q_none is None

    # Verify scaled scoring
    score = ScoringService.calculate_score(db, sess.id)
    assert score is not None
    assert score["total_score"] >= 400 and score["total_score"] <= 1600
    assert score["reading_scaled"] >= 200 and score["reading_scaled"] <= 800
    assert score["math_scaled"] >= 200 and score["math_scaled"] <= 800
