import pytest
from app.services.scoring_service import ScoringService

def test_scaled_score_limits():
    # Reading hard limits
    assert ScoringService.scale_score(0, "reading", "hard") == 200
    assert ScoringService.scale_score(54, "reading", "hard") == 800
    
    # Reading easy limits (capped at 700)
    assert ScoringService.scale_score(0, "reading", "easy") == 200
    assert ScoringService.scale_score(54, "reading", "easy") == 700
    
    # Math hard limits
    assert ScoringService.scale_score(0, "math", "hard") == 200
    assert ScoringService.scale_score(44, "math", "hard") == 800
    
    # Math easy limits (capped at 700)
    assert ScoringService.scale_score(0, "math", "easy") == 200
    assert ScoringService.scale_score(44, "math", "easy") == 700

def test_scaled_score_interpolation():
    # Intermediate scores: Reading hard
    # Anchor points: 25 -> 600, 30 -> 650
    # 27 is 2/5 of the way: 600 + 2/5*(50) = 620
    score = ScoringService.scale_score(27, "reading", "hard")
    assert score == 620
    
    # Intermediate scores: Math hard
    # Anchor points: 20 -> 550, 25 -> 610
    # 23 is 3/5 of the way: 550 + 3/5*(60) = 550 + 36 = 586 -> rounds to 590
    score = ScoringService.scale_score(23, "math", "hard")
    assert score == 590

def test_recommendation_generation(db):
    from app.models.models import User, StudentProfile, Topic, Question
    from app.services.recommendation_service import RecommendationService
    
    # 1. Create a student user and profile
    student = User(email="rec_student@example.com", password_hash="hash", role="student", is_verified=True)
    db.add(student)
    db.commit()
    db.refresh(student)
    
    profile = StudentProfile(user_id=student.id, target_score=1500)
    db.add(profile)
    db.commit()
    
    # 2. Seed some topics
    topic1 = Topic(name="Algebra Rules", subject="math", skill_domain="Algebra")
    topic2 = Topic(name="Context Clues", subject="reading", skill_domain="Craft & Structure")
    db.add_all([topic1, topic2])
    db.commit()
    db.refresh(topic1)
    db.refresh(topic2)
    
    # 3. Seed some questions
    q1 = Question(body="Q1", correct_option="A", difficulty="medium", topic_id=topic1.id, is_approved=True)
    q2 = Question(body="Q2", correct_option="B", difficulty="medium", topic_id=topic2.id, is_approved=True)
    db.add_all([q1, q2])
    db.commit()
    
    # 4. Generate recommendations
    recs = RecommendationService.generate_recommendations(db, student.id)
    assert len(recs) == 3
    assert recs[0].type == "practice_set"
    assert recs[1].type == "study_plan"
    assert recs[2].type == "next_test"
    
    # Check study plan contents
    assert recs[1].content["title"] == "7-Day Custom Revision Plan"
    assert "Monday" in recs[1].content["days"]
