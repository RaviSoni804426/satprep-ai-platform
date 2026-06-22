from sqlalchemy.orm import Session
from app.services.analytics_service import AnalyticsService
from app.models.models import StudentProfile

class CoachService:
    @staticmethod
    def answer_student_question(db: Session, student_id: str, question: str) -> dict:
        analytics = AnalyticsService.get_student_analytics(db, student_id)
        profile = db.query(StudentProfile).filter(StudentProfile.user_id == student_id).first()
        target = profile.target_score if profile else 1450
        best = analytics["best_score"]
        weak = analytics["weak_topics"]
        streak = analytics["streak_days"]
        
        q_lower = question.lower()
        
        # 1. "What should I study today?"
        if "study today" in q_lower or "what should i study" in q_lower or "do next" in q_lower:
            topic = weak[0] if weak else "Linear Equations"
            response = (
                f"Hi! Looking at your profile, your primary focus today should be **{topic}**. "
                f"You currently have some concept weaknesses here. I recommend completing the "
                f"12-question Practice Booster on your dashboard, followed by a 15-minute review of standard rules."
            )
            suggested_topic = topic
            
        # 2. "Why is my score dropping?"
        elif "dropping" in q_lower or "decrease" in q_lower or "low score" in q_lower:
            top_mistake = "careless mistakes"
            dist = analytics.get("mistake_distribution", {})
            if dist:
                top_mistake = max(dist, key=dist.get).lower()
                
            response = (
                f"Score fluctuations are completely normal. Your data shows that your errors are heavily "
                f"concentrated in **{top_mistake}** mistakes. This means you might be rushing or guessing under "
                f"time pressure. Try to spend at least 45 seconds on intermediate math questions and write down your steps!"
            )
            suggested_topic = weak[0] if weak else None
            
        # 3. "Can I reach my target score?"
        elif "reach my target" in q_lower or "target score" in q_lower or "can i get" in q_lower:
            gap = target - best if best > 0 else 200
            if gap <= 0:
                response = f"You have already cleared your target score of {target}! Keep taking mock tests weekly to maintain speed."
            elif gap <= 100:
                response = (
                    f"Absolutely! You are only {int(gap)} points away from your target of {target}. "
                    f"By focusing on **{weak[0] if weak else 'Algebra'}**, you can easily secure those extra points. "
                    f"Maintain your {streak}-day streak and take a mock test in 10 days."
                )
            else:
                response = (
                    f"Yes, you can! You have a {int(gap)}-point gap, which is very achievable in 4-6 weeks of focused practice. "
                    f"Make sure to follow the weekly Adaptive Learning Path on your dashboard, and resolve your concept "
                    f"weaknesses in **{', '.join(weak[:2]) if weak else 'Math'}** before taking another mock test."
                )
            suggested_topic = weak[0] if weak else None
            
        # 4. "What should I revise before the next mock?"
        elif "revise" in q_lower or "before the next mock" in q_lower or "preparation" in q_lower:
            topics_str = ", ".join(weak[:2]) if weak else "Linear Equations and grammar structures"
            response = (
                f"Before your next mock, I suggest doing a quick revision of: **{topics_str}**. "
                f"Review your previous incorrect answers in Review Mode first and check the misconceptions highlighted."
            )
            suggested_topic = weak[0] if weak else None
            
        # 5. Default fallback
        else:
            topics_str = ", ".join(weak[:2]) if weak else "Math and Reading"
            response = (
                f"I'm your AI Study Coach! I analyze your mock results to guide your SAT prep. "
                f"Currently, you've completed {analytics['total_mocks']} mocks and have a {streak}-day streak. "
                f"Your biggest growth areas are **{topics_str}**. Feel free to ask me what you should study, "
                f"how to hit your target score, or why your score might be dropping."
            )
            suggested_topic = weak[0] if weak else None
            
        return {
            "response": response,
            "suggested_topic": suggested_topic
        }
