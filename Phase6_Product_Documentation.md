# Product Documentation
## SATPrep AI – Adaptive Mock Test Portal for the Digital SAT

---

## 1. User Journeys

### 1.1 Student Journey

```
Discovery → Registration → Onboarding → Mock Test → Score Report → Study → Repeat
```

| Stage | Action | Platform Response |
|-------|--------|------------------|
| Discovery | Lands on marketing page | Sees value prop, CTA to register |
| Registration | Signs up via email or Google | OTP sent, profile created |
| Onboarding | Sets target score and test date | AI seeds initial recommendation |
| First Mock | Takes full 4-module adaptive test | Adaptive routing in real-time |
| Score Report | Views scaled score + breakdown | Weak areas flagged automatically |
| AI Guidance | Reviews recommendations | Gets practice set + study plan |
| Improvement Loop | Takes next mock | Trend tracked, new recommendations |

---

### 1.2 Counsellor Journey

```
Login → View Student Roster → Monitor Progress → Flag At-Risk Students → Export Reports
```

| Stage | Action |
|-------|--------|
| Login | Role-based redirect to counsellor dashboard |
| Monitoring | View all assigned students' scores and trends |
| Intervention | Identify at-risk students (score declining) |
| Communication | Use exported report in parent/student meeting |

---

## 2. Journey Maps

### Student: First Mock Test

```
Trigger: "I want to take my first practice SAT"
│
├── 1. Open Dashboard → click "Start New Mock"
├── 2. Select available test form
├── 3. Read instructions modal → click "Start"
├── 4. Module 1: Reading (32 min, 27 Qs)
│         Auto-save every 30s
│         Flag 3 uncertain questions
│         Review flagged → Submit Module 1
├── 5. Break screen (10 min countdown)
├── 6. Module 2: Reading – Hard (adaptive routing)
│         Complete and submit
├── 7. Module 1: Math (35 min, 22 Qs)
│         Use calculator on Q18
│         Submit
├── 8. Module 2: Math – Easy (adaptive routing)
│         Complete and submit
├── 9. "Test submitted. Calculating score..."
├── 10. Score report loads:
│         Total: 1340 | Reading: 640 | Math: 700
│         Weak: Geometry, Craft & Structure
├── 11. AI Recommendations generated
└── 12. Return to dashboard with updated trend
```

---

## 3. Process Flows

### 3.1 Adaptive Test Flow

```
                    ┌──────────────────┐
                    │   Start Test     │
                    └────────┬─────────┘
                             ↓
              ┌──────────────────────────┐
              │  Module 1: Reading       │
              │  (27 Qs, Fixed, 32 min)  │
              └──────────────┬───────────┘
                             ↓ Submit
              ┌──────────────────────────┐
              │   Calculate Raw Score    │
              └──────────────┬───────────┘
                             ↓
              Score ≥ 50%?
             /              \
           Yes               No
            ↓                 ↓
     Hard Module 2       Easy Module 2
     (Reading)           (Reading)
             \              /
              ↓            ↓
         ┌──────────────────────────┐
         │  Module 1: Math          │
         │  (22 Qs, Fixed, 35 min)  │
         └──────────────────────────┘
                      ↓ Same routing logic
         ┌──────────────────────────┐
         │  Module 2: Math          │
         │  (Hard or Easy)          │
         └──────────────────────────┘
                      ↓
         ┌──────────────────────────┐
         │   Final Score Generated  │
         └──────────────────────────┘
```

---

### 3.2 Score Calculation Flow

```
All 4 modules submitted
        ↓
Count correct answers per module
        ↓
Calculate raw scores: Module 1 + Module 2
        ↓
Map raw → scaled (lookup table per form)
        ↓
Reading Scaled + Math Scaled = Total
        ↓
Add confidence band (±30)
        ↓
Aggregate skill-wise scores
        ↓
Store in test_scores table
        ↓
Trigger: analytics aggregation + recommendation generation
```

---

### 3.3 Recommendation Flow

```
Event: test.completed (RabbitMQ)
        ↓
Fetch: student's session_answers + test_scores
        ↓
Calculate: accuracy per topic
        ↓
Identify: topics with accuracy < 60%
        ↓
Build:
  • Practice set (10–15 Qs from weak topics)
  • Revision topic list
  • 7-day study plan
  • Next mock suggestion (based on improvement rate)
        ↓
Store: recommendations table
        ↓
Notify: student (in-app badge + optional email)
```

---

## 4. Business Flows

### 4.1 New Student Onboarding

```
Student registers
  → Email OTP verified
  → Profile created (role: student)
  → Target score entered
  → Counsellor assigned (optional, by admin)
  → Initial AI recommendation seeded (based on target gap)
  → First mock test unlocked
```

### 4.2 Content Author Flow

```
Author logs in
  → Creates question (body, options, answer, explanation, topic, difficulty)
  → Saves as draft (is_approved: false)
  → Admin reviews → Approves
  → Question enters live question bank
  → Eligible for inclusion in test forms
```

### 4.3 Counsellor Reporting Flow

```
Counsellor opens dashboard
  → Views student roster (sorted by readiness level)
  → Clicks student → detail view (full analytics)
  → Downloads PDF or CSV report
  → Uses in parent meeting or advising session
```

---

## 5. Sequence Diagrams

### 5.1 Student Takes Adaptive Test

```
Student → Frontend: Click "Start Test"
Frontend → API: POST /tests/{id}/start
API → DB: Create session (status: in_progress)
API → Redis: Cache session state
API → Frontend: Return Module 1 questions + timer

[Student answers questions]
Frontend → API: POST /sessions/{id}/answers (auto-save)
API → Redis: Update answer state
API → S3: Snapshot every 30s

Student → Frontend: Click "Submit Module 1"
Frontend → API: POST /sessions/{id}/modules/1/submit
API → ScoringService: Calculate Module 1 raw score
API → AdaptiveRouter: Determine Module 2 difficulty
API → DB: Store routing decision
API → Frontend: Return Module 2 questions + difficulty label

[Repeat for Math modules]

Student → Frontend: Click "Submit Test"
Frontend → API: POST /sessions/{id}/submit
API → DB: Mark session complete
API → RabbitMQ: Publish test.completed event
API → Frontend: { status: "processing" }

Worker → ScoringService: Calculate final scores
Worker → DB: Write test_scores
Worker → RecommendationEngine: Generate recommendations
Worker → DB: Write recommendations

Student → Frontend: GET /sessions/{id}/score
Frontend → API: Fetch score
API → DB: Return score data
API → Frontend: Score report rendered
```

---

### 5.2 Test Resume Flow

```
Student → Frontend: Return to test URL
Frontend → API: GET /sessions/{id}/resume
API → Redis: Fetch session state
  If Redis miss → API → S3: Load latest snapshot
API → Frontend: Return current module, time_remaining, answers, flagged
Frontend: Restore UI to exact saved state
Student: Continues from where they left off
```
