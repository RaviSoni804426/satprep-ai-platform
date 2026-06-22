from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import List, Dict, Any, Optional
from datetime import datetime, date

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: str = Field(..., pattern="^(student|counsellor|author)$")
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class OTPVerify(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)

class Token(BaseModel):
    access_token: str
    refresh_token: str
    role: str
    expires_in: int = 900

class TokenRefreshRequest(BaseModel):
    refresh_token: str

class TokenRefreshResponse(BaseModel):
    access_token: str
    expires_in: int = 900

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    role: str
    full_name: Optional[str] = None
    target_score: Optional[int] = None
    counsellor_id: Optional[str] = None
    is_active: bool
    
class UserProfileUpdate(BaseModel):
    target_score: Optional[int] = None
    target_test_date: Optional[date] = None

class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    body: str
    option_a: Optional[str] = None
    option_b: Optional[str] = None
    option_c: Optional[str] = None
    option_d: Optional[str] = None
    difficulty: str
    topic_id: Optional[str] = None
    subject: str
    
class QuestionCreate(BaseModel):
    body: str
    option_a: Optional[str] = None
    option_b: Optional[str] = None
    option_c: Optional[str] = None
    option_d: Optional[str] = None
    correct_option: str
    explanation: Optional[str] = None
    difficulty: str
    topic_id: Optional[str] = None

class TestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    is_active: bool
    
class SessionStartOut(BaseModel):
    session_id: str
    current_question_no: int
    total_questions: int
    time_limit_seconds: int
    time_remaining: int
    questions: List[QuestionOut]

class AnswerSubmit(BaseModel):
    answers: Dict[str, str]
    flagged: List[str]
    time_remaining: int

class SubmitAnswerInput(BaseModel):
    question_id: str
    selected_option: Optional[str] = None
    time_taken_seconds: int = 0
    is_flagged: bool = False
    time_remaining: int

class SubmitAnswerOut(BaseModel):
    session_status: str  # 'in_progress', 'completed'
    current_question_no: int
    next_question: Optional[QuestionOut] = None

class AdaptiveSettingsOut(BaseModel):
    total_questions: int
    time_limit_seconds: int
    initial_ability_score: int
    min_difficulty: int
    max_difficulty: int
    adaptive_sensitivity: float
    min_difficulty_change: int
    max_difficulty_change: int
    question_exposure_limit: int
    blueprint: Dict[str, int]

class AdaptiveSettingsUpdate(BaseModel):
    total_questions: Optional[int] = None
    time_limit_seconds: Optional[int] = None
    adaptive_sensitivity: Optional[float] = None
    min_difficulty_change: Optional[int] = None
    max_difficulty_change: Optional[int] = None
    blueprint: Optional[Dict[str, int]] = None

class AdaptiveLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    question_number: int
    topic_name: Optional[str] = None
    question_difficulty: int
    is_correct: Optional[bool] = None
    ability_before: int
    ability_after: int
    selection_reason: Optional[str] = None
    time_taken_seconds: Optional[int] = None
    created_at: datetime

class ScoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session_id: str
    reading_raw: int
    reading_scaled: int
    math_raw: int
    math_scaled: int
    total_score: int
    band_low: int
    band_high: int
    skill_breakdown: Dict[str, int]
    
class SessionResumeOut(BaseModel):
    current_question_no: int
    total_questions: int
    time_remaining: int
    answers: Dict[str, str]
    flagged: List[str]
    questions: List[QuestionOut]

class StudentAnalyticsOut(BaseModel):
    total_mocks: int
    avg_score: int
    best_score: int
    score_trend: List[int]
    accuracy: Dict[str, int]
    weak_topics: List[str]
    avg_time_per_question_seconds: int
    # New analytics & gamification fields
    readiness_score: Optional[int] = 0
    improvement_since_last: Optional[int] = 0
    weekly_improvement: Optional[int] = 0
    xp_points: Optional[int] = 0
    streak_days: Optional[int] = 0
    badges: Optional[List[Dict[str, Any]]] = []
    learning_style: Optional[str] = "Visual & Practical"
    preferred_study_time: Optional[str] = "Evening (6 PM - 9 PM)"
    accuracy_by_topic: Optional[Dict[str, int]] = {}
    accuracy_by_difficulty: Optional[Dict[str, int]] = {}
    time_per_topic: Optional[Dict[str, int]] = {}
    mistake_distribution: Optional[Dict[str, int]] = {}
    consistency_score: Optional[int] = 0
    learning_curve: Optional[List[Dict[str, Any]]] = []
    prediction_graph: Optional[List[Dict[str, Any]]] = []
    today_study_plan: Optional[List[Dict[str, Any]]] = []
    next_recommended_action: Optional[Dict[str, Any]] = {}
    adaptive_learning_path: Optional[List[Dict[str, Any]]] = []

class CoachQuestionRequest(BaseModel):
    question: str

class CoachResponse(BaseModel):
    response: str
    suggested_topic: Optional[str] = None

class PlatformAnalyticsOut(BaseModel):
    total_tests_taken: int
    avg_platform_score: int
    completion_rate: float
    active_students_30d: int

class RecommendationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    title: str
    content: Dict[str, Any]
    generated_at: datetime

class RosterStudentOut(BaseModel):
    id: str
    full_name: Optional[str]
    latest_score: Optional[int]
    best_score: Optional[int]
    trend: str  # 'up', 'down', 'stable'
    status: str  # 'Ready', 'Almost Ready', 'Needs Work'
