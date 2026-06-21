# Database Design
## SATPrep AI – Adaptive Mock Test Portal for the Digital SAT

---

## 1. ER Diagram (Text Representation)

```
users ──────────────── student_profiles
  │                          │
  │                    counsellor_id (ref: users)
  │
  ├── test_sessions ──── session_answers
  │         │               └── questions
  │         └── test_scores
  │
  └── recommendations

tests ──── test_modules ──── module_questions ──── questions
                                                       │
                                                    topics
questions ──── question_tags ──── tags
```

---

## 2. Table Design

### `users`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, default gen_random_uuid() |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| role | ENUM | ('student','counsellor','author','admin') NOT NULL |
| is_verified | BOOLEAN | DEFAULT false |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMP | DEFAULT now() |
| updated_at | TIMESTAMP | DEFAULT now() |

---

### `student_profiles`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users.id, UNIQUE |
| counsellor_id | UUID | FK → users.id, NULLABLE |
| target_score | INTEGER | NULLABLE |
| target_test_date | DATE | NULLABLE |
| created_at | TIMESTAMP | DEFAULT now() |

---

### `tests`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| name | VARCHAR(255) | NOT NULL |
| description | TEXT | NULLABLE |
| is_active | BOOLEAN | DEFAULT true |
| created_by | UUID | FK → users.id |
| created_at | TIMESTAMP | DEFAULT now() |

---

### `test_modules`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| test_id | UUID | FK → tests.id |
| module_no | INTEGER | NOT NULL (1–4) |
| subject | ENUM | ('reading','math') |
| difficulty | ENUM | ('standard','easy','hard') |
| time_limit_seconds | INTEGER | NOT NULL |
| question_count | INTEGER | NOT NULL |

---

### `questions`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| body | TEXT | NOT NULL |
| option_a | TEXT | NOT NULL |
| option_b | TEXT | NOT NULL |
| option_c | TEXT | NOT NULL |
| option_d | TEXT | NOT NULL |
| correct_option | CHAR(1) | NOT NULL ('A'–'D') |
| explanation | TEXT | NULLABLE |
| difficulty | ENUM | ('easy','medium','hard') |
| topic_id | UUID | FK → topics.id |
| created_by | UUID | FK → users.id |
| is_approved | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMP | DEFAULT now() |

---

### `topics`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| name | VARCHAR(255) | NOT NULL |
| subject | ENUM | ('reading','math') |
| skill_domain | VARCHAR(255) | NOT NULL |

---

### `module_questions`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| module_id | UUID | FK → test_modules.id |
| question_id | UUID | FK → questions.id |
| display_order | INTEGER | NOT NULL |

---

### `test_sessions`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| student_id | UUID | FK → users.id |
| test_id | UUID | FK → tests.id |
| status | ENUM | ('in_progress','completed','abandoned') |
| current_module | INTEGER | DEFAULT 1 |
| module2_reading_difficulty | ENUM | ('easy','hard') NULLABLE |
| module2_math_difficulty | ENUM | ('easy','hard') NULLABLE |
| started_at | TIMESTAMP | DEFAULT now() |
| completed_at | TIMESTAMP | NULLABLE |

---

### `session_answers`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| session_id | UUID | FK → test_sessions.id |
| question_id | UUID | FK → questions.id |
| module_no | INTEGER | NOT NULL |
| selected_option | CHAR(1) | NULLABLE ('A'–'D') |
| is_correct | BOOLEAN | NULLABLE |
| is_flagged | BOOLEAN | DEFAULT false |
| time_taken_seconds | INTEGER | NULLABLE |
| answered_at | TIMESTAMP | NULLABLE |

---

### `test_scores`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| session_id | UUID | FK → test_sessions.id, UNIQUE |
| reading_raw | INTEGER | NOT NULL |
| reading_scaled | INTEGER | NOT NULL |
| math_raw | INTEGER | NOT NULL |
| math_scaled | INTEGER | NOT NULL |
| total_score | INTEGER | NOT NULL |
| band_low | INTEGER | NOT NULL |
| band_high | INTEGER | NOT NULL |
| skill_breakdown | JSONB | NOT NULL |
| calculated_at | TIMESTAMP | DEFAULT now() |

---

### `recommendations`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| student_id | UUID | FK → users.id |
| session_id | UUID | FK → test_sessions.id NULLABLE |
| type | ENUM | ('practice_set','study_plan','next_test','revision_topic') |
| content | JSONB | NOT NULL |
| is_dismissed | BOOLEAN | DEFAULT false |
| generated_at | TIMESTAMP | DEFAULT now() |

---

## 3. Indexing Strategy

| Table | Index | Reason |
|-------|-------|--------|
| users | idx_users_email | Login lookup |
| test_sessions | idx_sessions_student_id | Student's test history |
| test_sessions | idx_sessions_status | Filter active sessions |
| session_answers | idx_answers_session_id | Fetch all answers for scoring |
| questions | idx_questions_topic_difficulty | Question bank filtering |
| test_scores | idx_scores_student (via session join) | Dashboard score fetch |
| recommendations | idx_recs_student_id | Fetch student recommendations |

---

## 4. Database Dictionary (Key Fields)

| Table | Field | Purpose |
|-------|-------|---------|
| test_sessions | module2_reading_difficulty | Stores adaptive routing decision after Module 1 |
| test_scores | skill_breakdown | JSONB: `{"algebra": 85, "geometry": 70, ...}` |
| questions | is_approved | Content review gate before question goes live |
| session_answers | time_taken_seconds | Per-question timing for analytics |
| student_profiles | counsellor_id | Links student to their counsellor |

---

## 5. Constraints & Rules

- A student can have only one `in_progress` session per test at a time (enforced via partial unique index)
- `test_scores` is created only after all 4 modules are submitted
- `questions.is_approved = false` questions never appear in live tests
- `session_answers` are soft-inserted; unanswered questions remain with `selected_option = NULL`
