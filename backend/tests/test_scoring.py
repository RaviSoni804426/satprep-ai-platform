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
