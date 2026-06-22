import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Date, ForeignKey, Enum, JSON, Text, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)  # 'student', 'counsellor', 'author', 'admin'
    full_name = Column(String(255), nullable=True)
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    profile = relationship("StudentProfile", back_populates="user", uselist=False, foreign_keys="StudentProfile.user_id")
    sessions = relationship("TestSession", back_populates="student")
    recommendations = relationship("Recommendation", back_populates="student")
    events = relationship("Event", back_populates="user")

class StudentProfile(Base):
    __tablename__ = "student_profiles"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    counsellor_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    target_score = Column(Integer, nullable=True)
    target_test_date = Column(Date, nullable=True)
    xp_points = Column(Integer, default=0)
    streak_days = Column(Integer, default=0)
    last_active_date = Column(Date, nullable=True)
    learning_style = Column(String(100), default="Visual & Practical")
    preferred_study_time = Column(String(100), default="Evening (6 PM - 9 PM)")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="profile", foreign_keys=[user_id])
    counsellor = relationship("User", foreign_keys=[counsellor_id])

class Topic(Base):
    __tablename__ = "topics"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    subject = Column(String(50), nullable=False)  # 'reading', 'math'
    skill_domain = Column(String(255), nullable=False)

    questions = relationship("Question", back_populates="topic")

class Question(Base):
    __tablename__ = "questions"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    body = Column(Text, nullable=False)
    option_a = Column(Text, nullable=True)  # Nullable for SPR questions
    option_b = Column(Text, nullable=True)
    option_c = Column(Text, nullable=True)
    option_d = Column(Text, nullable=True)
    correct_option = Column(String(255), nullable=False)  # 'A', 'B', 'C', 'D' or numeric text
    explanation = Column(Text, nullable=True)
    difficulty = Column(String(50), nullable=False)  # 'easy', 'medium', 'hard'
    difficulty_score = Column(Integer, default=50)  # 1-100 scale for adaptive selecting
    common_misconception = Column(Text, nullable=True)
    related_concept = Column(Text, nullable=True)
    topic_id = Column(String(36), ForeignKey("topics.id", ondelete="SET NULL"), nullable=True)
    created_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_approved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    topic = relationship("Topic", back_populates="questions")
    module_questions = relationship("ModuleQuestion", back_populates="question")
    answers = relationship("SessionAnswer", back_populates="question")

class Test(Base):
    __tablename__ = "tests"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    modules = relationship("TestModule", back_populates="test", cascade="all, delete-orphan")
    sessions = relationship("TestSession", back_populates="test")

class TestModule(Base):
    __tablename__ = "test_modules"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    test_id = Column(String(36), ForeignKey("tests.id", ondelete="CASCADE"), nullable=False)
    module_no = Column(Integer, nullable=False)  # 1, 2 (for Reading) and 3, 4 (for Math) - or 1 to 4
    subject = Column(String(50), nullable=False)  # 'reading', 'math'
    difficulty = Column(String(50), nullable=False)  # 'standard', 'easy', 'hard'
    time_limit_seconds = Column(Integer, nullable=False)
    question_count = Column(Integer, nullable=False)

    # Relationships
    test = relationship("Test", back_populates="modules")
    questions = relationship("ModuleQuestion", back_populates="module", cascade="all, delete-orphan")

class ModuleQuestion(Base):
    __tablename__ = "module_questions"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    module_id = Column(String(36), ForeignKey("test_modules.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(String(36), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    display_order = Column(Integer, nullable=False)

    # Relationships
    module = relationship("TestModule", back_populates="questions")
    question = relationship("Question", back_populates="module_questions")

class TestSession(Base):
    __tablename__ = "test_sessions"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    student_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    test_id = Column(String(36), ForeignKey("tests.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), default="in_progress")  # 'in_progress', 'completed', 'abandoned'
    current_module = Column(Integer, default=1)
    module2_reading_difficulty = Column(String(50), nullable=True)  # 'easy', 'hard'
    module2_math_difficulty = Column(String(50), nullable=True)  # 'easy', 'hard'
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    student = relationship("User", back_populates="sessions")
    test = relationship("Test", back_populates="sessions")
    answers = relationship("SessionAnswer", back_populates="session", cascade="all, delete-orphan")
    score = relationship("TestScore", back_populates="session", uselist=False, cascade="all, delete-orphan")

class SessionAnswer(Base):
    __tablename__ = "session_answers"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("test_sessions.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(String(36), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    module_no = Column(Integer, nullable=False)
    selected_option = Column(String(255), nullable=True)  # Supports SPR responses too
    is_correct = Column(Boolean, nullable=True)
    is_flagged = Column(Boolean, default=False)
    time_taken_seconds = Column(Integer, nullable=True)
    mistake_type = Column(String(100), nullable=True)  # concept_error, calculation_error, reading_error, etc.
    answered_at = Column(DateTime, nullable=True)

    # Relationships
    session = relationship("TestSession", back_populates="answers")
    question = relationship("Question", back_populates="answers")

class TestScore(Base):
    __tablename__ = "test_scores"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("test_sessions.id", ondelete="CASCADE"), unique=True, nullable=False)
    reading_raw = Column(Integer, nullable=False)
    reading_scaled = Column(Integer, nullable=False)
    math_raw = Column(Integer, nullable=False)
    math_scaled = Column(Integer, nullable=False)
    total_score = Column(Integer, nullable=False)
    band_low = Column(Integer, nullable=False)
    band_high = Column(Integer, nullable=False)
    skill_breakdown = Column(JSON, nullable=False)
    calculated_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    session = relationship("TestSession", back_populates="score")

class Recommendation(Base):
    __tablename__ = "recommendations"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    student_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(String(36), ForeignKey("test_sessions.id", ondelete="SET NULL"), nullable=True)
    type = Column(String(50), nullable=False)  # 'practice_set', 'study_plan', 'next_test', 'revision_topic'
    content = Column(JSON, nullable=False)
    is_dismissed = Column(Boolean, default=False)
    generated_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    student = relationship("User", back_populates="recommendations")

class Event(Base):
    __tablename__ = "events"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    event_name = Column(String(100), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    session_id = Column(String(36), ForeignKey("test_sessions.id", ondelete="SET NULL"), nullable=True)
    properties = Column(JSON, nullable=True)
    occurred_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    user = relationship("User", back_populates="events")
