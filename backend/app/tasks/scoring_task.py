import logging
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.services.scoring_service import ScoringService
from app.services.recommendation_service import RecommendationService

logger = logging.getLogger(__name__)

def process_score_and_recommendations(session_id: str, student_id: str) -> None:
    db = SessionLocal()
    try:
        logger.info(f"Background scoring started for session: {session_id}")
        # 1. Calculate and save mock test scores
        score = ScoringService.calculate_score(db, session_id)
        if score:
            logger.info(f"Score calculated: {score.total_score} for session: {session_id}")
            # 2. Generate personalized recommendations based on the score/topics
            recs = RecommendationService.generate_recommendations(db, student_id, session_id)
            logger.info(f"Generated {len(recs)} recommendations for student: {student_id}")
        else:
            logger.error(f"Scoring service failed to generate score for session: {session_id}")
    except Exception as e:
        logger.error(f"Error in background scoring task: {e}")
    finally:
        db.close()
