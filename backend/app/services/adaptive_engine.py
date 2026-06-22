import json
import random
import logging
from sqlalchemy.orm import Session
from app.models.models import TestSession, Question, Topic, SystemSetting
from typing import Tuple, List, Dict, Any

logger = logging.getLogger(__name__)

class AdaptiveEngine:
    @staticmethod
    def update_ability(
        ability: int, 
        difficulty: int, 
        is_correct: bool, 
        sensitivity: float = 1.0, 
        min_change: int = 2, 
        max_change: int = 15
    ) -> int:
        """
        Updates a student's ability score (0-1000 scale) based on question correctness
        and difficulty difference using a simplified psychometric IRT-like approach.
        """
        # Rescale ability to 1-100 to compare with question difficulty score (1-100)
        ability_scaled = ability / 10.0
        diff_factor = (difficulty - ability_scaled) / 100.0  # Range: -1.0 to 1.0
        
        if is_correct:
            # Answering a harder question gives a larger boost
            raw_change = min_change + (max_change - min_change) * (1.0 + diff_factor)
            change = int(raw_change * sensitivity)
            change = max(min_change, min(max_change, change))
        else:
            # Failing an easier question yields a larger drop
            raw_change = - (min_change + (max_change - min_change) * (1.0 - diff_factor))
            change = int(raw_change * sensitivity)
            change = min(-min_change, max(-max_change, change))
            
        new_ability = ability + change
        return max(0, min(1000, new_ability))

    @staticmethod
    def select_next_question(
        db: Session, 
        student_id: str, 
        session: TestSession, 
        adaptive_config: dict, 
        blueprint_config: dict
    ) -> Tuple[Question, str]:
        """
        Dynamically selects the next best question for the student based on:
        - Ability Score (rescaled difficulty target)
        - SAT Blueprint Target Distribution
        - Previous Question Attempt History in current session
        - Question Exposure Pools (distributes usage)
        """
        # 1. Decode session served topics and served question IDs
        served_counts = {}
        if session.topic_counts:
            if isinstance(session.topic_counts, str):
                try:
                    served_counts = json.loads(session.topic_counts)
                except Exception:
                    served_counts = {}
            elif isinstance(session.topic_counts, dict):
                served_counts = session.topic_counts

        served_ids = []
        if session.questions_list:
            if isinstance(session.questions_list, str):
                try:
                    served_ids = json.loads(session.questions_list)
                except Exception:
                    served_ids = []
            elif isinstance(session.questions_list, list):
                served_ids = session.questions_list

        # 2. Apply blueprint rules: filter topics which still need questions
        eligible_topics = []
        for t_name, target in blueprint_config.items():
            served = served_counts.get(t_name, 0)
            if served < target:
                eligible_topics.append((t_name, target - served))

        # Fallback if all topic targets are satisfied (just in case)
        if not eligible_topics:
            eligible_topics = [(t_name, 999) for t_name in blueprint_config.keys()]

        # Sort topics by remaining questions count (highest first) to balance coverage
        eligible_topics.sort(key=lambda x: x[1], reverse=True)
        chosen_topic_name = eligible_topics[0][0]

        # 3. Retrieve topic detail from DB
        topic_obj = db.query(Topic).filter(Topic.name == chosen_topic_name).first()
        if not topic_obj:
            # Fallback: get any topic
            topic_obj = db.query(Topic).first()
            chosen_topic_name = topic_obj.name

        # 4. Determine student's target difficulty score based on subject ability
        # Reading ability vs Math ability
        if topic_obj.subject == "reading":
            ability = session.ability_score_reading
        else:
            ability = session.ability_score_math

        # Target difficulty rescaled to 1-100
        target_diff = int(ability / 10.0)

        # 5. Fetch candidate questions for the chosen topic
        candidates = db.query(Question).filter(
            Question.topic_id == topic_obj.id,
            Question.is_approved == True,
            ~Question.id.in_(served_ids) if served_ids else True
        ).all()

        # Fallback A: pick other topics of the same subject that have available questions
        if not candidates:
            candidates = db.query(Question).join(Topic).filter(
                Topic.subject == topic_obj.subject,
                Question.is_approved == True,
                ~Question.id.in_(served_ids) if served_ids else True
            ).all()

        # Fallback B: pick *any* available approved question
        if not candidates:
            candidates = db.query(Question).filter(
                Question.is_approved == True,
                ~Question.id.in_(served_ids) if served_ids else True
            ).all()

        if not candidates:
            raise Exception("No more questions available in the question bank!")

        # 6. Sort by proximity to target difficulty score (1-100)
        candidates.sort(key=lambda q: abs((q.difficulty_score or 50) - target_diff))

        # 7. Exposure Pool selection (select randomly from the top 3 closest to avoid identical tracks)
        pool_size = min(3, len(candidates))
        pool = candidates[:pool_size]
        selected_q = random.choice(pool)

        reason = (
            f"Topic '{chosen_topic_name}' chosen (remaining target is {eligible_topics[0][1]}). "
            f"Target difficulty score: {target_diff} (based on student {topic_obj.subject} ability {ability}). "
            f"Question difficulty score: {selected_q.difficulty_score}."
        )

        return selected_q, reason
