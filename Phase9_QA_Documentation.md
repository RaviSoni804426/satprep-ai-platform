# QA Documentation
## SATPrep AI – Adaptive Mock Test Portal for the Digital SAT

---

## 1. Test Strategy

| Type | Tool | Coverage Target |
|------|------|----------------|
| Unit Tests | pytest | 80%+ line coverage |
| Integration Tests | pytest + TestClient | All API endpoints |
| E2E Tests | Playwright | Critical user flows |
| Load Tests | Locust | 500 concurrent users |
| Security Tests | OWASP ZAP | Pre-release scan |
| UAT | Manual | Sign-off by stakeholders |

---

## 2. Test Cases – Authentication

| ID | Test | Input | Expected |
|----|------|-------|---------|
| AUTH-01 | Valid email login | Correct email + password | 200 + JWT tokens |
| AUTH-02 | Invalid password | Wrong password | 401 INVALID_CREDENTIALS |
| AUTH-03 | Locked account | 5 failed logins → 6th attempt | 403 ACCOUNT_LOCKED |
| AUTH-04 | OTP valid | Correct 6-digit OTP | 200 + auth token |
| AUTH-05 | OTP expired | OTP after 5 min | 410 OTP_EXPIRED |
| AUTH-06 | OTP wrong | Incorrect OTP | 401 INVALID_OTP |
| AUTH-07 | Token refresh | Valid refresh token | 200 + new access token |
| AUTH-08 | Expired access token | Expired JWT | 401 TOKEN_EXPIRED |
| AUTH-09 | Google OAuth success | Valid Google code | 200 + JWT |
| AUTH-10 | Role enforcement | Student hits /admin route | 403 FORBIDDEN |

---

## 3. Test Cases – Test Engine

| ID | Test | Input | Expected |
|----|------|-------|---------|
| TEST-01 | Start test | Valid student, valid test_id | 201 + Module 1 questions |
| TEST-02 | Duplicate start | Active session exists | 409 ACTIVE_SESSION_EXISTS |
| TEST-03 | Auto-save answers | Partial answers JSON | 200 + saved_at timestamp |
| TEST-04 | Flag question | Question ID in flagged[] | Question marked, returned in resume |
| TEST-05 | Submit Module 1 | All 27 answers provided | Module 2 returned with difficulty label |
| TEST-06 | Adaptive: Hard routing | ≥14/27 correct in Module 1 | module_2_difficulty = "hard" |
| TEST-07 | Adaptive: Easy routing | < 14/27 correct in Module 1 | module_2_difficulty = "easy" |
| TEST-08 | Timer expiry | Client clock hits 0:00 | Module auto-submitted; next module served |
| TEST-09 | Final submit | All 4 modules submitted | 202 processing status |
| TEST-10 | Resume test | Active session exists | Restores correct module, time, answers |
| TEST-11 | Submit already-completed session | Session status = completed | 400 SESSION_ALREADY_COMPLETED |

---

## 4. Test Cases – Scoring

| ID | Test | Input | Expected |
|----|------|-------|---------|
| SCORE-01 | Perfect reading score | 27/27 correct (hard path) | Reading scaled = 800 |
| SCORE-02 | Zero reading score | 0/27 correct | Reading scaled = 200 |
| SCORE-03 | Perfect total | 800 + 800 | Total = 1600 |
| SCORE-04 | Confidence band | Total = 1400 | Band: 1370–1430 |
| SCORE-05 | Skill breakdown | Varied topic accuracy | Per-topic % returned correctly |
| SCORE-06 | Score not ready | Score still processing | 202 SCORE_PROCESSING |
| SCORE-07 | Different paths same raw | Easy vs Hard path, same raw score | Different scaled scores (hard path rewards higher) |

---

## 5. Test Cases – Analytics

| ID | Test | Expected |
|----|------|---------|
| ANAL-01 | First mock: no trend | Trend array has 1 entry |
| ANAL-02 | Weak topic detection | Topic with < 60% accuracy + ≥5 attempts flagged |
| ANAL-03 | Topic not flagged yet | < 5 attempts → not in weak list |
| ANAL-04 | Time analysis | Avg time per question per topic returned |
| ANAL-05 | Counsellor access | Can view assigned student's analytics |
| ANAL-06 | Counsellor access (unassigned) | 403 returned for unassigned student |

---

## 6. Test Cases – Recommendations

| ID | Test | Expected |
|----|------|---------|
| REC-01 | Recommendation generated | After test.completed event, rec exists in DB within 10s |
| REC-02 | Practice set relevance | Questions only from weak topics |
| REC-03 | Practice set exclusion | No previously seen questions in set |
| REC-04 | Study plan days | 7-day plan returned with topic per day |
| REC-05 | Dismiss recommendation | is_dismissed = true; not returned in next fetch |
| REC-06 | On track student | Next mock in 7 days |
| REC-07 | Gap > 100 pts | Next mock in 14 days |

---

## 7. Edge Cases

| Scenario | Handling |
|----------|---------|
| Student submits no answers in module | Raw score = 0; easy Module 2 |
| All questions flagged, none answered | Auto-submit on timer; score 0 for that module |
| Session Redis key expires (server restart) | Load from S3 snapshot |
| Question deleted after test started | Serve cached version from session snapshot |
| Two devices open same test session | Second device gets 409; redirected to active session |
| Student manipulates timer in client | Timer is server-authoritative; client-side only for display |
| Negative score from bad routing | Floor applied: min scaled score = 200 |
| Concurrent final submits | Idempotency check on session_id; second request returns existing score |

---

## 8. Load Testing Scenarios (Locust)

| Scenario | Virtual Users | Duration | Pass Criteria |
|----------|--------------|----------|--------------|
| Normal load | 100 VU | 10 min | p95 < 500ms, error rate < 1% |
| Peak load | 500 VU | 5 min | p95 < 1s, error rate < 2% |
| Exam season spike | 800 VU ramp | 10 min | No crash; auto-scaling kicks in |
| Auto-save flood | 200 VU saving every 30s | 10 min | No DB lock; Redis handles load |
| Score calculation queue | 50 simultaneous test completions | Burst | All scores calculated within 15s |

---

## 9. UAT Scenarios

| Scenario | User | Acceptance |
|---------|------|-----------|
| Full adaptive mock (4 modules) | Student | Routing correct; score accurate; report loads |
| Resume after network drop | Student | Restores to exact question + time |
| View all students + export | Counsellor | Data accurate; export downloads correctly |
| Approve question → appears in test | Admin + Author | Approved question usable in forms |
| Configure adaptive threshold | Admin | Routing changes reflect new threshold |
| Score report PDF download | Student | PDF renders correctly with all sections |

---

## 10. Acceptance Criteria Summary

| Feature | Criteria |
|---------|---------|
| Adaptive routing | 100% correct routing based on Module 1 score |
| Score range | Reading and Math always within 200–800 |
| Timer | Accurate to ±1 second; auto-submits exactly at 0:00 |
| Auto-save | State recoverable within 30s of any answer change |
| Recommendations | Generated within 10 seconds of test completion |
| Dashboard load | < 2 seconds with full data |
| API p95 latency | < 500ms under normal load |
