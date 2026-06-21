# Analytics Documentation
## SATPrep AI – Adaptive Mock Test Portal for the Digital SAT

---

## 1. Analytics Strategy

**Purpose:** Track product usage, student performance, platform health, and business KPIs.

**Stack:**
- Event tracking: Custom events → PostgreSQL (analytics schema)
- Dashboards: Admin portal (built-in) + CloudWatch
- Async processing: RabbitMQ consumers write to analytics tables

---

## 2. Event Tracking Plan

### 2.1 Auth Events

| Event | Trigger | Properties |
|-------|---------|-----------|
| `user.registered` | New account created | user_id, role, method (email/google) |
| `user.login` | Successful login | user_id, role, ip, method |
| `user.login_failed` | Failed login attempt | email (hashed), ip, attempt_count |
| `user.logout` | Logout action | user_id |

---

### 2.2 Test Events

| Event | Trigger | Properties |
|-------|---------|-----------|
| `test.started` | Student starts a mock | student_id, test_id, session_id |
| `test.module_submitted` | Module submitted | session_id, module_no, subject, raw_score, difficulty |
| `test.completed` | All 4 modules done | session_id, total_score, reading_score, math_score |
| `test.abandoned` | Session inactive > 2 hrs | session_id, last_module_reached |
| `test.resumed` | Student resumes test | session_id, time_remaining_on_resume |
| `question.flagged` | Student flags a Q | session_id, question_id, module_no |
| `question.answered` | Answer selected | session_id, question_id, time_taken |

---

### 2.3 Dashboard Events

| Event | Trigger | Properties |
|-------|---------|-----------|
| `dashboard.viewed` | Student opens dashboard | student_id |
| `recommendation.viewed` | Rec shown to student | student_id, rec_id, rec_type |
| `recommendation.clicked` | Student acts on rec | student_id, rec_id, rec_type |
| `recommendation.dismissed` | Student dismisses | student_id, rec_id |
| `score_report.viewed` | Score report opened | student_id, session_id |
| `score_report.downloaded` | PDF downloaded | student_id, session_id |

---

### 2.4 Counsellor / Admin Events

| Event | Trigger | Properties |
|-------|---------|-----------|
| `counsellor.dashboard_viewed` | Counsellor logs in | counsellor_id |
| `counsellor.student_viewed` | Clicks a student | counsellor_id, student_id |
| `report.exported` | CSV/PDF exported | actor_id, export_type, student_id or "all" |
| `question.approved` | Admin approves Q | admin_id, question_id |
| `user.role_changed` | Admin changes role | admin_id, target_user_id, old_role, new_role |

---

## 3. KPI Dashboard

### Student KPIs

| KPI | Formula | Target |
|-----|---------|--------|
| Score improvement rate | (latest_score - first_score) / first_score | ≥ 10% after 3 mocks |
| Mock completion rate | completed_sessions / started_sessions | ≥ 85% |
| Avg weak topics per student | sum(weak_topics) / students | < 3 |
| Recommendation CTR | rec_clicked / rec_viewed | ≥ 30% |
| Study plan adoption | plan_followed / plan_generated | ≥ 50% |

---

### Platform KPIs

| KPI | Formula | Target |
|-----|---------|--------|
| DAU | Unique users with events in last 24h | — |
| MAU | Unique users with events in last 30d | — |
| DAU/MAU Ratio | DAU / MAU | ≥ 40% |
| Avg session duration | total_time_on_platform / sessions | ≥ 45 min |
| Tests per student/month | total_tests / active_students | ≥ 2 |
| Platform uptime | (total_mins - downtime_mins) / total_mins | ≥ 99.9% |

---

### Business KPIs

| KPI | Formula | Target |
|-----|---------|--------|
| Score prediction accuracy | students within ±30 pts / total | ≥ 80% |
| Student retention (30d) | students_active_2nd_month / new_students | ≥ 70% |
| Counsellor weekly active | counsellors_with_events / total_counsellors | ≥ 70% |
| NPS | % Promoters − % Detractors | ≥ 50 |
| Content author productivity | questions_approved / questions_created | ≥ 90% |

---

## 4. Analytics Dashboards

### 4.1 Student Analytics Dashboard

**Visible to:** Student (own data), Counsellor (assigned students), Admin (all)

| Section | Data Shown |
|---------|-----------|
| Score Summary | Latest, best, avg across all mocks |
| Score Trend | Line chart: score per attempt |
| Section Breakdown | Reading vs Math per attempt |
| Accuracy by Topic | Bar chart: % correct per topic |
| Time per Topic | Avg seconds per question per topic |
| Weak Areas | Topics < 60% accuracy |
| Module 2 Difficulty History | Which path (easy/hard) each attempt |

---

### 4.2 Counsellor Dashboard

| Section | Data Shown |
|---------|-----------|
| Student Roster | All assigned students: latest score, trend, readiness |
| At-Risk Students | Students with declining trend or > 100 pts below target |
| Class Average | Avg score across cohort |
| Improvement Rate | % students improved since last month |

---

### 4.3 Admin Analytics Dashboard

| Section | Data Shown |
|---------|-----------|
| Platform Overview | Total users, active students, tests taken today/week/month |
| Score Distribution | Histogram of all scores |
| Completion Rate | % tests completed vs abandoned |
| Module 2 Routing Distribution | % Hard vs Easy per form |
| Question Performance | Per-question correct rate (flags bad questions) |
| Recommendation Engagement | CTR, dismissal rate per rec type |

---

## 5. Analytics DB Schema (Key Tables)

### `events`
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES users(id),
  session_id UUID NULLABLE,
  properties JSONB,
  occurred_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_events_name_user ON events(event_name, user_id);
CREATE INDEX idx_events_occurred ON events(occurred_at);
```

### `platform_daily_stats`
```sql
CREATE TABLE platform_daily_stats (
  date DATE PRIMARY KEY,
  dau INTEGER,
  tests_started INTEGER,
  tests_completed INTEGER,
  avg_score NUMERIC(5,1),
  completion_rate NUMERIC(4,3)
);
```
*(Populated nightly by cron job)*

---

## 6. Analytics Processing

### Real-Time
- Events written synchronously to `events` table on user action
- Redis counters for DAU (incremented on login/event, expire at midnight)

### Async (RabbitMQ consumers)
- `test.completed` → aggregate topic accuracy → update `student_topic_stats`
- `test.completed` → update `platform_daily_stats`
- Recommendation engagement → update `recommendation_stats`

### Nightly Cron
- Compute score trends per student
- Identify new weak topics
- Update readiness labels
- Refresh counsellor dashboard aggregates
