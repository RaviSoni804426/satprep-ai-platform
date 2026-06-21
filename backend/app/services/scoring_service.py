from sqlalchemy.orm import Session
from app.repository.db_repo import SessionRepository, ScoreRepository, QuestionRepository
from app.models.models import TestScore, SessionAnswer, Question, Topic
from typing import Dict, Any, Tuple

# Digital SAT curve anchor points
READING_HARD_CURVE = {
    0: 200, 5: 280, 10: 360, 15: 440, 20: 520, 25: 600,
    30: 650, 35: 700, 40: 730, 45: 760, 50: 780, 54: 800
}

READING_EASY_CURVE = {
    0: 200, 5: 260, 10: 320, 15: 380, 20: 440, 25: 500,
    30: 540, 35: 580, 40: 610, 45: 640, 50: 670, 54: 700
}

MATH_HARD_CURVE = {
    0: 200, 5: 290, 10: 380, 15: 470, 20: 550, 25: 610,
    30: 670, 35: 720, 40: 760, 44: 800
}

MATH_EASY_CURVE = {
    0: 200, 5: 270, 10: 340, 15: 410, 20: 480, 25: 530,
    30: 580, 35: 620, 40: 660, 44: 700
}

class ScoringService:
    @staticmethod
    def _interpolate(raw: int, curve: Dict[int, int]) -> int:
        if raw in curve:
            return curve[raw]
            
        # Find flanking points
        sorted_keys = sorted(curve.keys())
        lower_key = sorted_keys[0]
        upper_key = sorted_keys[-1]
        
        for k in sorted_keys:
            if k < raw:
                lower_key = k
            if k > raw:
                upper_key = k
                break
                
        # Interpolate linearly
        val_range = curve[upper_key] - curve[lower_key]
        key_range = upper_key - lower_key
        ratio = (raw - lower_key) / key_range
        
        interpolated = curve[lower_key] + int(ratio * val_range)
        # Round to nearest 10 (SAT increments)
        return round(interpolated / 10) * 10

    @staticmethod
    def scale_score(raw: int, subject: str, difficulty_path: str) -> int:
        if subject == "reading":
            curve = READING_HARD_CURVE if difficulty_path == "hard" else READING_EASY_CURVE
            max_raw = 54
        else:
            curve = MATH_HARD_CURVE if difficulty_path == "hard" else MATH_EASY_CURVE
            max_raw = 44
            
        raw = max(0, min(raw, max_raw))
        scaled = ScoringService._interpolate(raw, curve)
        return max(200, min(800, scaled))

    @staticmethod
    def calculate_score(db: Session, session_id: str) -> Optional[TestScore]:
        sess = SessionRepository.get_session_by_id(db, session_id)
        if not sess:
            return None
            
        answers = SessionRepository.get_session_answers(db, session_id)
        
        # Calculate raw counts
        # Modules 1 and 2 are Reading/Writing
        reading_answers = [a for a in answers if a.module_no in (1, 2)]
        reading_raw = sum(1 for a in reading_answers if a.is_correct is True)
        
        # Modules 3 and 4 are Math
        math_answers = [a for a in answers if a.module_no in (3, 4)]
        math_raw = sum(1 for a in math_answers if a.is_correct is True)
        
        # Scale scores
        reading_path = sess.module2_reading_difficulty or "easy"
        math_path = sess.module2_math_difficulty or "easy"
        
        reading_scaled = ScoringService.scale_score(reading_raw, "reading", reading_path)
        math_scaled = ScoringService.scale_score(math_raw, "math", math_path)
        
        total_score = reading_scaled + math_scaled
        band_low = max(400, total_score - 30)
        band_high = min(1600, total_score + 30)
        
        # Skill breakdown
        # Aggregate correct / total per skill domain
        skill_counts = {}
        for ans in answers:
            q = QuestionRepository.get_question_by_id(db, ans.question_id)
            if q and q.topic:
                domain = q.topic.skill_domain
                if domain not in skill_counts:
                    skill_counts[domain] = {"correct": 0, "total": 0}
                skill_counts[domain]["total"] += 1
                if ans.is_correct is True:
                    skill_counts[domain]["correct"] += 1
                    
        skill_breakdown = {}
        for domain, stats in skill_counts.items():
            if stats["total"] > 0:
                skill_breakdown[domain] = int((stats["correct"] / stats["total"]) * 100)
            else:
                skill_breakdown[domain] = 0
                
        # Fill in defaults if any standard domains are missing
        standard_domains = ["Algebra", "Advanced Math", "Problem Solving & Data Analysis", "Geometry & Trigonometry",
                            "Information & Ideas", "Craft & Structure", "Expression of Ideas", "Standard English Conventions"]
        for domain in standard_domains:
            if domain not in skill_breakdown:
                skill_breakdown[domain] = 0

        # Save to database
        score = ScoreRepository.save_score(
            db, session_id,
            reading_raw, reading_scaled,
            math_raw, math_scaled,
            total_score, band_low, band_high,
            skill_breakdown
        )
        return score
