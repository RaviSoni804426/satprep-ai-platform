# API Documentation
## SATPrep AI – Adaptive Mock Test Portal for the Digital SAT

**Base URL:** `https://api.satprepai.com/v1`  
**Auth:** Bearer JWT token in `Authorization` header  
**Format:** JSON request/response

---

## 1. Authentication APIs

### POST /auth/register
Register a new student or counsellor.

**Request:**
```json
{
  "email": "student@example.com",
  "password": "SecurePass123!",
  "role": "student",
  "full_name": "Arjun Sharma"
}
```
**Response `201`:**
```json
{ "message": "OTP sent to email", "user_id": "uuid" }
```
**Errors:** `400 EMAIL_EXISTS`, `422 VALIDATION_ERROR`

---

### POST /auth/otp/verify
Verify OTP sent during registration or login.

**Request:**
```json
{ "email": "student@example.com", "otp": "482910" }
```
**Response `200`:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "expires_in": 900
}
```
**Errors:** `401 INVALID_OTP`, `410 OTP_EXPIRED`

---

### POST /auth/login
Email + password login.

**Request:**
```json
{ "email": "student@example.com", "password": "SecurePass123!" }
```
**Response `200`:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "role": "student"
}
```
**Errors:** `401 INVALID_CREDENTIALS`, `403 ACCOUNT_INACTIVE`

---

### POST /auth/refresh
Refresh access token.

**Request:**
```json
{ "refresh_token": "eyJ..." }
```
**Response `200`:**
```json
{ "access_token": "eyJ...", "expires_in": 900 }
```
**Errors:** `401 INVALID_REFRESH_TOKEN`

---

### POST /auth/logout
Invalidate current session.

**Headers:** `Authorization: Bearer <token>`  
**Response `200`:** `{ "message": "Logged out" }`

---

## 2. User APIs

### GET /users/me
Get current user profile.

**Response `200`:**
```json
{
  "id": "uuid",
  "email": "student@example.com",
  "role": "student",
  "full_name": "Arjun Sharma",
  "target_score": 1400,
  "counsellor_id": "uuid"
}
```

---

### PATCH /users/me
Update profile.

**Request:**
```json
{ "target_score": 1450, "target_test_date": "2025-03-08" }
```
**Response `200`:** Updated user object

---

### GET /users (Admin only)
List all users with filters.

**Query Params:** `role`, `page`, `limit`, `search`  
**Response `200`:**
```json
{
  "total": 4000,
  "page": 1,
  "data": [ { "id": "uuid", "email": "...", "role": "student" } ]
}
```

---

## 3. Test APIs

### GET /tests
List available tests for the student.

**Response `200`:**
```json
{
  "data": [
    { "id": "uuid", "name": "Full Mock SAT #3", "is_active": true }
  ]
}
```

---

### POST /tests/{test_id}/start
Start a new test session.

**Response `201`:**
```json
{
  "session_id": "uuid",
  "module_no": 1,
  "subject": "reading",
  "time_limit_seconds": 1920,
  "questions": [
    {
      "id": "uuid",
      "order": 1,
      "body": "The passage suggests...",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." }
    }
  ]
}
```
**Errors:** `409 ACTIVE_SESSION_EXISTS`, `404 TEST_NOT_FOUND`

---

### POST /sessions/{session_id}/answers
Auto-save or submit answers for current module.

**Request:**
```json
{
  "answers": { "question_uuid": "B", "question_uuid_2": "A" },
  "flagged": ["question_uuid_3"],
  "time_remaining": 900
}
```
**Response `200`:** `{ "saved": true, "saved_at": "2025-01-15T10:30:00Z" }`

---

### POST /sessions/{session_id}/modules/{module_no}/submit
Submit a module and get the next module (if applicable).

**Response `200`:**
```json
{
  "module_submitted": 1,
  "next_module": {
    "module_no": 2,
    "subject": "reading",
    "difficulty": "hard",
    "time_limit_seconds": 1920,
    "questions": [ ... ]
  }
}
```
**Errors:** `400 MODULE_ALREADY_SUBMITTED`, `403 SESSION_MISMATCH`

---

### POST /sessions/{session_id}/submit
Final submission of the full test.

**Response `202`:**
```json
{ "status": "processing", "message": "Score will be ready in under 10 seconds" }
```

---

### GET /sessions/{session_id}/score
Fetch score report after test completion.

**Response `200`:**
```json
{
  "session_id": "uuid",
  "reading_scaled": 680,
  "math_scaled": 740,
  "total_score": 1420,
  "band_low": 1390,
  "band_high": 1450,
  "skill_breakdown": {
    "algebra": 88,
    "geometry": 72,
    "information_ideas": 91,
    "craft_structure": 65
  }
}
```
**Errors:** `202 SCORE_PROCESSING`, `404 SESSION_NOT_FOUND`

---

### GET /sessions/{session_id}/resume
Resume an interrupted test.

**Response `200`:**
```json
{
  "current_module": 2,
  "time_remaining": 847,
  "answers": { "q_uuid": "C" },
  "flagged": ["q_uuid_2"],
  "questions": [ ... ]
}
```
**Errors:** `404 NO_ACTIVE_SESSION`

---

## 4. Analytics APIs

### GET /analytics/me
Student's own analytics summary.

**Response `200`:**
```json
{
  "total_mocks": 5,
  "avg_score": 1320,
  "best_score": 1410,
  "score_trend": [1200, 1260, 1300, 1350, 1410],
  "accuracy": { "reading": 74, "math": 81 },
  "weak_topics": ["craft_structure", "geometry"],
  "avg_time_per_question_seconds": 62
}
```

---

### GET /analytics/students/{student_id} (Counsellor/Admin)
Analytics for a specific student.

**Response `200`:** Same structure as `/analytics/me`

---

### GET /analytics/platform (Admin only)
Platform-wide analytics.

**Response `200`:**
```json
{
  "total_tests_taken": 12400,
  "avg_platform_score": 1290,
  "completion_rate": 0.87,
  "active_students_30d": 3100
}
```

---

## 5. Recommendation APIs

### GET /recommendations/me
Fetch latest recommendations for logged-in student.

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "practice_set",
      "title": "Algebra Booster – 12 Questions",
      "content": { "question_ids": ["uuid1", "uuid2", "..."] },
      "generated_at": "2025-01-15T08:00:00Z"
    },
    {
      "id": "uuid",
      "type": "study_plan",
      "title": "7-Day Plan: Weak Area Focus",
      "content": { "days": { "Monday": ["Craft & Structure", "Linear Equations"] } }
    }
  ]
}
```

---

### PATCH /recommendations/{rec_id}/dismiss
Dismiss a recommendation.

**Response `200`:** `{ "dismissed": true }`

---

## 6. Admin APIs

### POST /admin/questions
Add a new question.

**Request:**
```json
{
  "body": "Which choice...",
  "option_a": "...", "option_b": "...", "option_c": "...", "option_d": "...",
  "correct_option": "B",
  "explanation": "Because...",
  "difficulty": "hard",
  "topic_id": "uuid"
}
```
**Response `201`:** `{ "id": "uuid", "is_approved": false }`

---

### PATCH /admin/questions/{question_id}/approve
Approve question for use in live tests.

**Response `200`:** `{ "is_approved": true }`

---

### GET /admin/reports/export
Export platform report as CSV.

**Query Params:** `type=scores|users|completion`, `from`, `to`  
**Response `200`:** CSV file download

---

## 7. Error Code Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| INVALID_CREDENTIALS | 401 | Wrong email or password |
| OTP_EXPIRED | 410 | OTP TTL exceeded (5 min) |
| TOKEN_EXPIRED | 401 | JWT access token expired |
| FORBIDDEN | 403 | Insufficient role permissions |
| NOT_FOUND | 404 | Resource doesn't exist |
| ACTIVE_SESSION_EXISTS | 409 | Student already has live session for this test |
| SCORE_PROCESSING | 202 | Score not yet ready |
| VALIDATION_ERROR | 422 | Request body fails validation |
| RATE_LIMITED | 429 | Too many requests (> 100/min) |
| SERVER_ERROR | 500 | Unexpected server failure |
