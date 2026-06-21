# AI Documentation
## SATPrep AI – Adaptive Mock Test Portal for the Digital SAT

---

## 1. Adaptive Engine

### 1.1 Purpose
Dynamically assign Module 2 difficulty (Easy or Hard) based on student's Module 1 performance — mirroring the actual Digital SAT algorithm.

### 1.2 Routing Algorithm

```python
ROUTING_THRESHOLD = 0.50  # Configurable by Admin (default: 50%)

def determine_module2_difficulty(
    module1_answers: list[bool],
    threshold: float = ROUTING_THRESHOLD
) -> Literal["easy", "hard"]:
    correct = sum(module1_answers)
    total = len(module1_answers)
    accuracy = correct / total
    return "hard" if accuracy >= threshold else "easy"
```

### 1.3 Module Configuration

| Module | Subject | Type | Questions | Time |
|--------|---------|------|-----------|------|
| 1 | Reading | Standard | 27 | 32 min |
| 2A | Reading | Easy | 27 | 32 min |
| 2B | Reading | Hard | 27 | 32 min |
| 3 | Math | Standard | 22 | 35 min |
| 4A | Math | Easy | 22 | 35 min |
| 4B | Math | Hard | 22 | 35 min |

### 1.4 Calibration
- Thresholds validated against official College Board score tables
- Admin can adjust threshold per test form (range: 40%–70%)
- Routing decisions stored for audit and model improvement

---

## 2. Score Prediction Engine

### 2.1 Purpose
Estimate a student's likely actual SAT score based on mock performance.

### 2.2 Scoring Model

**Step 1: Raw Score**
```
raw_reading = correct answers in Module 1R + Module 2R
raw_math    = correct answers in Module 1M + Module 2M
```

**Step 2: Scaled Score (Lookup Table)**
```python
# Simplified mapping (actual table has all raw values)
READING_SCALE = {
    0: 200, 5: 240, 10: 290, 15: 370,
    20: 490, 25: 680, 27: 800
    # (Module 1 Hard path) or (Easy path) — different tables
}

def scale_score(raw: int, subject: str, difficulty_path: str) -> int:
    table = get_scale_table(subject, difficulty_path)
    return table.get(raw, interpolate(raw, table))
```

**Step 3: Total Score**
```
total_score = reading_scaled + math_scaled  # 400–1600
```

**Step 4: Confidence Band**
```
band_low  = total_score - 30
band_high = total_score + 30
```

### 2.3 Accuracy Tracking
- Predicted score vs actual SAT outcome logged (when students share results)
- Model recalibrated if prediction drift > ±50 points for > 20% of students

---

## 3. Recommendation Engine

### 3.1 Purpose
Generate personalised study guidance after each mock test completion.

### 3.2 Architecture

```
Inputs:
  • session_answers (per-question accuracy + time)
  • historical mock scores (trend data)
  • student target score
  • days until target test date

Processing:
  1. Topic Accuracy Scorer
  2. Weak Area Detector
  3. Time Efficiency Analyser
  4. Priority Ranker
  5. Output Builder

Outputs:
  • Practice Set (questions)
  • Revision Topic List
  • 7-Day Study Plan
  • Next Mock Recommendation
```

### 3.3 Weak Area Detection

```python
MIN_ATTEMPTS = 5  # Minimum questions answered in topic to flag

def detect_weak_topics(student_id: str) -> list[str]:
    topic_stats = get_topic_accuracy(student_id)
    weak = []
    for topic, stats in topic_stats.items():
        if stats["attempts"] >= MIN_ATTEMPTS and stats["accuracy"] < 0.60:
            weak.append(topic)
    return sorted(weak, key=lambda t: topic_stats[t]["accuracy"])  # worst first
```

### 3.4 Practice Set Builder

```python
def build_practice_set(weak_topics: list[str], size: int = 12) -> list[Question]:
    questions = []
    per_topic = size // len(weak_topics)
    for topic in weak_topics:
        qs = get_questions(
            topic=topic,
            difficulty="medium",  # Start with medium, increase next round
            exclude_seen=True,
            limit=per_topic
        )
        questions.extend(qs)
    return questions[:size]
```

### 3.5 Study Plan Generator

```python
def build_study_plan(weak_topics: list[str], days: int = 7) -> dict:
    plan = {}
    topics_cycle = cycle(weak_topics)  # itertools.cycle
    for day in range(1, days + 1):
        topic = next(topics_cycle)
        plan[day] = {
            "focus": topic,
            "tasks": [
                f"Review {topic} concept notes (30 min)",
                f"Complete 10 practice questions: {topic} (45 min)",
                "Review mistakes (15 min)"
            ]
        }
    return plan
```

### 3.6 Next Mock Recommendation

```python
def recommend_next_mock_date(score_trend: list[int], target_score: int) -> date:
    recent_avg = mean(score_trend[-3:])
    gap = target_score - recent_avg
    if gap <= 0:
        days_out = 7   # On track: mock weekly
    elif gap <= 100:
        days_out = 10  # Close: mock in 10 days
    else:
        days_out = 14  # Far: more study time first
    return date.today() + timedelta(days=days_out)
```

---

## 4. Readiness Level Algorithm (Counsellor View)

```python
def compute_readiness(latest_score: int, target_score: int, trend: list[int]) -> str:
    gap = target_score - latest_score
    recent_delta = trend[-1] - trend[-2] if len(trend) >= 2 else 0

    if gap <= 0:
        return "Ready"
    elif gap <= 100 and recent_delta >= 0:
        return "Almost Ready"
    else:
        return "Needs Work"
```

**Display in Counsellor Dashboard:**
| Label | Condition |
|-------|-----------|
| ✅ Ready | Latest score ≥ target |
| ⚠️ Almost Ready | Within 100 pts, not declining |
| 🔴 Needs Work | > 100 pts below target OR declining trend |

---

## 5. AI Pipeline Architecture

```
Test Completed (event)
        ↓
RabbitMQ: test.completed
        ↓
AI Worker (Python, FastAPI background task)
  ├── Fetch: session_answers, test_scores, student profile
  ├── Run: WeakAreaDetector
  ├── Run: PracticeSetBuilder
  ├── Run: StudyPlanGenerator
  ├── Run: NextMockRecommender
  └── Run: ReadinessCalculator
        ↓
Write: recommendations table
        ↓
Notify: student (in-app) + counsellor (if at-risk)
```

---

## 6. Future AI Enhancements (Phase 2+)

| Feature | Approach |
|---------|---------|
| Question difficulty calibration | IRT (Item Response Theory) model |
| Score prediction ML model | Logistic regression on historical outcomes |
| Smart question sequencing | Bandit algorithm per practice session |
| NLP question tagging | Fine-tuned classifier for topic auto-tagging |
