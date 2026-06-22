from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from app.repository.db_repo import RecommendationRepository, SessionRepository, QuestionRepository
from app.models.models import Recommendation, SessionAnswer, Question, Topic, User, StudentProfile, TestScore
from datetime import datetime, timedelta, date
import random

class RecommendationService:
    @staticmethod
    def get_topic_stats(db: Session, student_id: str) -> dict:
        # Fetch all answers for the student
        sessions = db.query(SessionAnswer)\
            .join(SessionAnswer.session)\
            .filter(SessionAnswer.session.has(student_id=student_id))\
            .all()
            
        topic_stats = {}
        for ans in sessions:
            q = QuestionRepository.get_question_by_id(db, ans.question_id)
            if q and q.topic:
                t_id = q.topic_id
                t_name = q.topic.name
                if t_id not in topic_stats:
                    topic_stats[t_id] = {"name": t_name, "correct": 0, "attempts": 0}
                topic_stats[t_id]["attempts"] += 1
                if ans.is_correct is True:
                    topic_stats[t_id]["correct"] += 1
                    
        return topic_stats

    @staticmethod
    def detect_weak_topics(db: Session, student_id: str) -> list:
        stats = RecommendationService.get_topic_stats(db, student_id)
        weak = []
        
        # Rule: attempts >= 5 and accuracy < 60%
        for t_id, data in stats.items():
            acc = data["correct"] / data["attempts"]
            if data["attempts"] >= 5 and acc < 0.60:
                weak.append((t_id, data["name"], acc))
                
        # If no weak topics found under strict rule, relax it to catch areas for new students
        if not weak:
            for t_id, data in stats.items():
                acc = data["correct"] / data["attempts"]
                if data["attempts"] >= 1 and acc < 0.75:
                    weak.append((t_id, data["name"], acc))
                    
        # Sort by accuracy (lowest first)
        weak.sort(key=lambda x: x[2])
        return [w[0] for w in weak]  # Return list of topic IDs

    @staticmethod
    def generate_recommendations(db: Session, student_id: str, session_id: str = None) -> list:
        # Delete old recommendations to avoid clutter
        db.query(Recommendation).filter(and_(
            Recommendation.student_id == student_id,
            Recommendation.is_dismissed == False
        )).update({Recommendation.is_dismissed: True})
        db.commit()
        
        # 1. Detect weak topics
        weak_topic_ids = RecommendationService.detect_weak_topics(db, student_id)
        
        # If student has no history yet, seed default topics
        if not weak_topic_ids:
            all_topics = QuestionRepository.get_all_topics(db)
            if all_topics:
                # Seed with a mix of reading and math
                weak_topic_ids = [t.id for t in all_topics[:3]]
            else:
                return []
                
        # Get names of weak topics
        weak_topics = []
        for t_id in weak_topic_ids:
            t = QuestionRepository.get_topic_by_id(db, t_id)
            if t:
                weak_topics.append(t)
                
        weak_names = [t.name for t in weak_topics]
        
        # Exclude seen questions
        seen_answers = db.query(SessionAnswer.question_id)\
            .join(SessionAnswer.session)\
            .filter(SessionAnswer.session.has(student_id=student_id))\
            .all()
        seen_ids = [a[0] for a in seen_answers]
        
        # Analyze mistake patterns
        incorrect_answers = db.query(SessionAnswer)\
            .join(SessionAnswer.session)\
            .filter(and_(
                SessionAnswer.session.has(student_id=student_id),
                SessionAnswer.is_correct == False
            )).all()
            
        mistake_patterns = {}
        for ans in incorrect_answers:
            m_type = ans.mistake_type or "concept_error"
            mistake_patterns[m_type] = mistake_patterns.get(m_type, 0) + 1
            
        top_mistake = max(mistake_patterns, key=mistake_patterns.get) if mistake_patterns else "concept_error"
        top_mistake_label = top_mistake.replace("_", " ").title()

        # Analyze timing pressure (check for questions with > 75 seconds and wrong)
        slow_questions_count = sum(1 for ans in incorrect_answers if ans.time_taken_seconds and ans.time_taken_seconds > 75)
        timing_pressure_flag = slow_questions_count >= 3
        
        # 2. Build Practice Set (10-15 questions)
        practice_qs = []
        for topic_id in weak_topic_ids:
            qs = db.query(Question).filter(and_(
                Question.topic_id == topic_id,
                Question.is_approved == True,
                ~Question.id.in_(seen_ids) if seen_ids else True
            )).limit(5).all()
            practice_qs.extend(qs)
            
        random.shuffle(practice_qs)
        practice_qs = practice_qs[:12]  # Cap at 12
        
        if len(practice_qs) < 5:
            qs = db.query(Question).filter(and_(
                Question.topic_id.in_(weak_topic_ids),
                Question.is_approved == True
            )).limit(10).all()
            practice_qs = qs
            
        # Explanations of why shown
        if timing_pressure_flag:
            ps_reason = f"Shown because you missed multiple questions in {weak_names[0] if weak_names else 'Algebra'} under time pressure (> 75s per question)."
        else:
            ps_reason = f"Shown because your accuracy in {weak_names[0] if weak_names else 'Algebra'} is currently below 65%, with frequent '{top_mistake_label}' errors."

        practice_set_content = {
            "title": f"Weak Area Booster ({len(practice_qs)} Questions)",
            "topics": weak_names[:2],
            "reason": ps_reason,
            "question_ids": [q.id for q in practice_qs],
            "questions": [{
                "id": q.id,
                "body": q.body,
                "option_a": q.option_a,
                "option_b": q.option_b,
                "option_c": q.option_c,
                "option_d": q.option_d,
                "difficulty": q.difficulty,
                "topic": q.topic.name if q.topic else "General"
            } for q in practice_qs]
        }
        
        rec1 = RecommendationRepository.create_recommendation(
            db, student_id, session_id, "practice_set", practice_set_content
        )
        
        # 3. Build Study Plan (7 days)
        study_plan_days = {}
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        
        for i, day in enumerate(days):
            topic = weak_topics[i % len(weak_topics)]
            # Customize study plan tasks based on top mistake
            if top_mistake == "calculation_error":
                tasks = [
                    f"Review arithmetic foundations for {topic.name} ({topic.subject}) - 20 mins",
                    f"Complete 8 practice questions, double checking scratch work step-by-step - 40 mins",
                    f"Flag any algebraic sign errors or division slip-ups - 15 mins"
                ]
            elif top_mistake == "reading_error":
                tasks = [
                    f"Read carefully the passage context for {topic.name} - 25 mins",
                    f"Underline the core thesis statements and answer 8 practice questions - 35 mins",
                    f"Identify exactly where choices misrepresent text nuances - 15 mins"
                ]
            else:
                tasks = [
                    f"Review core definitions and formulas for {topic.name} ({topic.subject}) - 30 mins",
                    f"Solve 10 practice questions on {topic.name} - 45 mins",
                    f"Analyze errors and review explanations - 15 mins"
                ]
                
            study_plan_days[day] = {
                "topic": topic.name,
                "subject": topic.subject.capitalize(),
                "domain": topic.skill_domain,
                "tasks": tasks
            }
            
        study_plan_content = {
            "title": "7-Day Custom Revision Plan",
            "reason": f"Created to fix your primary '{top_mistake_label}' misconception pattern through structured daily review.",
            "days": study_plan_days
        }
        
        rec2 = RecommendationRepository.create_recommendation(
            db, student_id, session_id, "study_plan", study_plan_content
        )
        
        # 4. Next Test Recommendation
        profile = db.query(StudentProfile).filter(StudentProfile.user_id == student_id).first()
        target_score = profile.target_score if (profile and profile.target_score) else 1450
        
        # Get score average
        recent_scores = db.query(TestScore.total_score)\
            .join(TestScore.session)\
            .filter(TestScore.session.has(student_id=student_id))\
            .order_by(desc(TestScore.calculated_at))\
            .limit(3)\
            .all()
            
        recent_scores = [s[0] for s in recent_scores]
        
        if recent_scores:
            avg_score = sum(recent_scores) / len(recent_scores)
            gap = target_score - avg_score
        else:
            gap = 200
            
        if gap <= 0:
            days_out = 7
            reason = f"Excellent job! You are currently scoring at or above your target score of {target_score}. Take a weekly mock test to maintain momentum and speed."
        elif gap <= 100:
            days_out = 10
            reason = f"You are close to your target score (only {int(gap)} points away). Study your weak topics for 10 days, then take the next mock to clear the gap."
        else:
            days_out = 14
            reason = f"There is a gap of {int(gap)} points to your target of {target_score}. We recommend taking 2 weeks to study weak topics before trying another full mock."
            
        recommend_date = date.today() + timedelta(days=days_out)
        
        next_test_content = {
            "title": "Recommended Next Mock Test",
            "recommend_date": recommend_date.strftime("%Y-%m-%d"),
            "days_out": days_out,
            "reason": reason
        }
        
        rec3 = RecommendationRepository.create_recommendation(
            db, student_id, session_id, "next_test", next_test_content
        )
        
        return [rec1, rec2, rec3]
