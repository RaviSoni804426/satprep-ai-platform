# Low Level Design (LLD)
## SATPrep AI – Adaptive Mock Test Portal for the Digital SAT

---

## 1. Module-wise Design

### 1.1 Auth Module

**Components:**
- `AuthRouter` – FastAPI router for `/auth` endpoints
- `AuthService` – Business logic: login, register, OTP, token refresh
- `JWTHandler` – Token generation, validation, expiry
- `OTPService` – Generate, store (Redis, TTL 5min), verify OTP
- `RBACMiddleware` – Validates role from JWT on every protected route

**Flow:**
```
POST /auth/login
  → Validate email + password (bcrypt compare)
  → Generate JWT (access + refresh)
  → Return tokens

POST /auth/otp/verify
  → Check OTP in Redis (key: otp:{email})
  → If match → mark verified → return auth token
  → If expired → return 401
```

---

### 1.2 Test Engine Module

**Components:**
- `TestSessionManager` – Create, fetch, update test sessions
- `QuestionServer` – Fetch ordered questions from DB by form_id
- `AdaptiveRouter` – Determine Module 2 difficulty based on Module 1 score
- `AutoSaveWorker` – Background task: dump session to S3 every 30s
- `ResumeHandler` – Restore session from Redis or S3 snapshot

**Adaptive Routing Logic:**
```python
def route_module2(module1_raw_score: int, total_questions: int, threshold_pct: float = 0.5) -> str:
    if module1_raw_score / total_questions >= threshold_pct:
        return "hard"
    return "easy"
```

**Session State (Redis key: `session:{session_id}`):**
```json
{
  "student_id": "uuid",
  "test_id": "uuid",
  "current_module": 2,
  "answers": { "q_id": "selected_option" },
  "time_remaining": 1820,
  "flagged": ["q_id_1", "q_id_3"],
  "status": "in_progress"
}
```

---

### 1.3 Scoring Module

**Components:**
- `RawScoreCalculator` – Count correct answers per module
- `ScaledScoreMapper` – Map raw score → scaled score (lookup table per form)
- `ConfidenceBandGenerator` – Add ±30 band to final scores
- `SkillScoreBreakdown` – Aggregate scores by skill domain

**Scaled Score Mapping:**
```
raw_to_scaled = {
  "reading": { 0: 200, 5: 240, 10: 280, ... 27: 800 },
  "math":    { 0: 200, 5: 250, 10: 310, ... 44: 800 }
}
```

**Final Score:**
```
total_score = reading_scaled + math_scaled  # Range: 400–1600
```

---

### 1.4 Analytics Module

**Components:**
- `AccuracyAggregator` – Correct/total per topic per student
- `TimeAnalyser` – Avg time per question type
- `WeakAreaDetector` – Topics with accuracy < 60%
- `TrendCalculator` – Score delta across attempts

**Weak Area Rule:**
```
if accuracy(topic) < 0.60 AND attempts(topic) >= 5:
    flag_as_weak(topic)
```

---

### 1.5 Recommendation Module

**Components:**
- `RecommendationEngine` – Rule-based + ML hybrid
- `PracticeSetBuilder` – Pull 10–15 questions from weak topics
- `StudyPlanGenerator` – Build 7-day plan from weak areas + time available
- `NextTestRecommender` – Suggest mock date based on trend

**Recommendation Trigger (via RabbitMQ):**
```
Event: test.completed
  → Consume → fetch weak areas → run engine → store in DB → notify student
```

---

## 2. Database Flow

### Entity Relationships (Key Tables)

```
users (id, email, role, created_at)
  └── student_profiles (user_id, counsellor_id, target_score)
  └── test_sessions (id, student_id, test_id, status, started_at)
       └── session_answers (session_id, question_id, selected_option, is_correct, time_taken)
       └── test_scores (session_id, reading_score, math_score, total_score, band_low, band_high)

tests (id, name, form_id, created_at)
  └── test_modules (id, test_id, module_no, subject, difficulty, time_limit)
       └── module_questions (module_id, question_id, order)

questions (id, text, options, correct_answer, difficulty, topic_id, explanation)
  └── topics (id, name, subject, skill_domain)

recommendations (id, student_id, generated_at, type, content_json)
```

---

## 3. API Flow

### Start Test
```
POST /tests/{test_id}/start
  → Auth check (student role)
  → Check: no active session for same test_id
  → Create session in PostgreSQL (status: in_progress)
  → Load Module 1 questions → cache in Redis
  → Return: session_id, questions[], time_limit
```

### Submit Module
```
POST /sessions/{session_id}/modules/{module_no}/submit
  → Validate session ownership
  → Calculate Module 1 raw score
  → Call AdaptiveRouter → determine Module 2 difficulty
  → Load Module 2 questions
  → Return: next_module_questions[], time_limit
```

### Final Submit
```
POST /sessions/{session_id}/submit
  → Mark session complete
  → Enqueue: score.calculate job (RabbitMQ)
  → Return: { status: "processing", estimated_wait: "< 10s" }
```

### Get Score
```
GET /sessions/{session_id}/score
  → Fetch from test_scores table
  → Return: reading, math, total, band, skill_breakdown
```

---

## 4. Class Design (Core Services)

```python
class TestSessionManager:
    def create_session(student_id, test_id) -> Session
    def get_session(session_id) -> Session
    def update_answers(session_id, answers: dict) -> None
    def mark_complete(session_id) -> None

class AdaptiveRouter:
    def get_module2_difficulty(session_id, module1_no) -> str  # "easy" | "hard"

class ScoringService:
    def calculate_raw(session_id, module_no) -> int
    def calculate_scaled(raw, subject) -> int
    def generate_report(session_id) -> ScoreReport

class RecommendationEngine:
    def generate(student_id) -> Recommendation
    def build_practice_set(weak_topics: list) -> list[Question]
    def build_study_plan(student_id, days=7) -> StudyPlan
```

---

## 5. Error Handling

| Scenario | Handling |
|---------|---------|
| Session expired mid-test | Resume from S3 snapshot, restore timer |
| DB write fails on answer save | Retry 3x, fallback to Redis only |
| Score job fails in queue | Dead-letter queue → alert + manual retry |
| Adaptive routing edge case | Default to "easy" Module 2 |
| Duplicate test start | Return existing active session |
| JWT expired | Return 401 with refresh token hint |
