# Business Requirements Document (BRD)
## SATPrep AI – Adaptive Mock Test Portal for the Digital SAT

---

## 1. Executive Summary

SATPrep AI is a cloud-based SaaS platform replicating the Digital SAT experience with adaptive testing, AI-driven recommendations, and data-driven counsellor insights. It targets 4,000 current students with a roadmap to 50,000+.

---

## 2. Business Goals

| # | Goal |
|---|------|
| 1 | Replicate the real Digital SAT adaptive experience |
| 2 | Improve score prediction accuracy |
| 3 | Provide personalized learning paths |
| 4 | Increase student engagement and retention |
| 5 | Enable data-driven counselling |
| 6 | Build a scalable EdTech SaaS platform |

---

## 3. Scope

### In Scope
- Adaptive mock test engine (4-module structure)
- Student, Counsellor, and Admin dashboards
- AI recommendation engine
- Analytics and reporting
- Cloud deployment (AWS)

### Out of Scope
- Live tutoring / video sessions
- Mobile native apps (Phase 2)
- Payment gateway integration (Phase 2)

---

## 4. Stakeholders

| Role | Interest |
|------|----------|
| Students | Realistic SAT prep, score improvement |
| Counsellors | Student performance monitoring |
| Content Authors | Question bank management |
| Admins | Platform management |
| Operations Team | Monitoring and support |
| Product Manager | Feature delivery, roadmap |

---

## 5. Functional Requirements

### 5.1 Authentication
- Email/password login
- Google OAuth login
- OTP verification
- JWT-based session management
- Role-Based Access Control (RBAC): Student, Counsellor, Content Author, Admin

### 5.2 Adaptive Test Engine
- Module 1 (Reading): Fixed difficulty, 27 questions, 32 min
- Module 2 (Reading): Adaptive — Easy or Hard based on Module 1 score
- Module 1 (Math): Fixed difficulty, 22 questions, 35 min
- Module 2 (Math): Adaptive — Easy or Hard based on Module 1 score
- Routing logic: Score ≥ threshold → Hard Module 2; else → Easy Module 2

### 5.3 Test Player
- Countdown timer per module
- Flag questions for review
- Auto-save every 30 seconds
- Resume interrupted tests
- Desmos calculator (Math modules)
- Text highlighting (Reading modules)
- Formula reference sheet

### 5.4 Scoring Engine
- Reading scaled score (200–800)
- Math scaled score (200–800)
- Total SAT score (400–1600)
- Confidence band (±30 points)
- Skill-wise sub-scores

### 5.5 Question Bank CMS
- Add/edit/delete questions
- Tag by topic, difficulty, skill domain
- Attach explanations
- Bulk import via CSV
- Build test forms from question pool

### 5.6 Student Dashboard
- Latest and historical scores
- Progress trend charts
- Weak area highlights
- AI recommendations panel
- Mock test history

### 5.7 Counsellor Dashboard
- Student roster with scores
- Improvement trends
- Weak area flags
- Readiness level indicator (Not Ready / Almost Ready / Ready)

### 5.8 Admin Portal
- User management (CRUD)
- Test management
- Adaptive routing rule configuration
- Question bank oversight
- Platform analytics
- Report generation

### 5.9 AI Recommendation Engine
- Suggest practice question sets
- Recommend revision topics
- Generate weekly study plans
- Recommend next mock test timing

---

## 6. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | Page load < 2s; test submission < 1s |
| Availability | 99.9% uptime SLA |
| Scalability | Support 500+ concurrent users; scale to 50,000 students |
| Security | OWASP Top 10 compliance, data encryption at rest and in transit |
| Reliability | Auto-resume on network drop during test |
| Compliance | Student data privacy (FERPA-aligned) |
| Accessibility | WCAG 2.1 AA |

---

## 7. Business Rules

- A student must complete Module 1 before Module 2 is unlocked.
- Adaptive routing is determined solely by Module 1 raw score.
- Students cannot retake the same test form within 7 days.
- Counsellors can view only their assigned students.
- Content Authors cannot publish questions without Admin approval.
- Scores are calculated only after all 4 modules are submitted.

---

## 8. Acceptance Criteria

| Feature | Acceptance Criteria |
|---------|-------------------|
| Adaptive Routing | Module 2 difficulty switches correctly based on Module 1 score 100% of the time |
| Score Calculation | Generated score within ±30 points of actual SAT score for 80%+ students |
| Timer | Countdown accurate; auto-submits on expiry |
| Auto-Save | Test state saved within 30s of any answer change |
| Resume | Student resumes from exact question and time remaining |
| Dashboard | Dashboard loads within 2 seconds with full data |

---

## 9. Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Inaccurate adaptive routing | High | Validate routing thresholds with real SAT data |
| Score prediction drift | High | Regular model retraining with outcome data |
| Database bottleneck at scale | High | Read replicas + Redis caching |
| Cheating / question leaks | Medium | Randomized question pools, DRM controls |
| Data loss during test | High | Auto-save + S3 backup |

---

## 10. KPIs

| KPI | Target |
|-----|--------|
| Score prediction accuracy | ±30 pts for ≥80% of students |
| Test completion rate | ≥85% |
| Student retention (monthly) | ≥70% |
| Counsellor report generation time | < 5 seconds |
| Platform uptime | ≥99.9% |
| Avg. session duration | ≥45 minutes |
