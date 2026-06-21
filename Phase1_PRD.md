# Product Requirements Document (PRD)
## SATPrep AI – Adaptive Mock Test Portal for the Digital SAT

---

## 1. Product Vision

> Build the most realistic Digital SAT preparation platform that adapts to every student, predicts scores accurately, and empowers counsellors with data — so every student walks into the exam confident.

---

## 2. Target Users & Pain Points

| User | Pain Point | How We Solve It |
|------|-----------|----------------|
| Student | Non-adaptive mocks waste time | Adaptive engine mirrors real SAT |
| Student | Don't know weak areas | Skill-wise analytics + AI recommendations |
| Counsellor | No visibility into student readiness | Counsellor dashboard with readiness scores |
| Content Author | Manual question management is slow | CMS with bulk import and tagging |
| Admin | No platform-wide analytics | Admin analytics portal |

---

## 3. Feature List & Prioritization (MoSCoW)

### Must Have (MVP)
- Adaptive 4-module test engine
- JWT auth with Google login + OTP
- Student dashboard (score, history, trends)
- Scoring engine (200–800 per section)
- Question Bank CMS
- Timer, flag, auto-save, resume
- Basic analytics (accuracy, time, topic)

### Should Have
- AI recommendation engine
- Counsellor dashboard
- Confidence band in score report
- PDF score reports

### Could Have
- Study plan generator
- Leaderboards
- Notification system (email/SMS)

### Won't Have (v1)
- Mobile native apps
- Video lessons
- Payment gateway

---

## 4. User Stories

### Student
```
As a student, I want to take an adaptive mock SAT so that my experience matches the real exam.
As a student, I want to see my score immediately after the test so I know where I stand.
As a student, I want AI recommendations so I know what to study next.
As a student, I want to resume a dropped test so I don't lose progress.
As a student, I want to see my weak topics so I can focus my prep.
```

### Counsellor
```
As a counsellor, I want to see all my students' scores so I can track their progress.
As a counsellor, I want readiness indicators so I can advise students on test dates.
As a counsellor, I want to export reports so I can share them with parents.
```

### Admin
```
As an admin, I want to manage users and roles so I control platform access.
As an admin, I want to configure adaptive routing rules so the engine stays accurate.
As an admin, I want to approve questions before they go live so quality is maintained.
```

### Content Author
```
As a content author, I want to add and tag questions so they're correctly assigned to topics and difficulty.
As a content author, I want bulk import from CSV so I can work efficiently.
```

---

## 5. Feature Specifications

### 5.1 Adaptive Test Engine

**Flow:**
```
Student starts test
  → Module 1: Reading (27 Qs, 32 min)
  → Score calculated
    → Score ≥ threshold → Hard Reading Module 2
    → Score < threshold → Easy Reading Module 2
  → Module 1: Math (22 Qs, 35 min)
  → Score calculated
    → Score ≥ threshold → Hard Math Module 2
    → Score < threshold → Easy Math Module 2
  → Final score calculated
```

**Routing Threshold:** Configurable by Admin (default: ≥ 50% correct in Module 1)

### 5.2 Scoring Engine

| Component | Scale | Contribution |
|-----------|-------|-------------|
| Reading & Writing | 200–800 | 50% |
| Math | 200–800 | 50% |
| Total | 400–1600 | — |

- Scores based on IRT (Item Response Theory) model
- Confidence band: ±30 points displayed on report

### 5.3 Test Player Features

| Feature | Behaviour |
|---------|-----------|
| Timer | Counts down per module; auto-submits on 0:00 |
| Flag | Mark any question; review before submission |
| Auto-Save | Every 30 seconds; also on each answer change |
| Resume | Restore exact question + remaining time |
| Calculator | Desmos embedded in Math modules only |
| Highlight | Select and highlight text in Reading passages |
| Formula Sheet | Pop-up modal in Math modules |

### 5.4 AI Recommendation Engine

**Inputs:** Accuracy per topic, time per question, score trend, weak flags

**Outputs:**
- Top 3 weak topics to revise this week
- Recommended practice set (10–15 questions)
- Suggested next mock date
- Weekly study plan (Mon–Sun)

**Trigger:** Auto-generated after each mock submission

---

## 6. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Score prediction accuracy | ±30 pts, ≥80% students | Compare predicted vs actual SAT score |
| Test completion rate | ≥85% | Completed tests / started tests |
| DAU/MAU ratio | ≥40% | Analytics events |
| Recommendation click-through | ≥30% | User action tracking |
| Counsellor dashboard adoption | ≥70% of counsellors weekly active | Login events |
| NPS | ≥50 | Monthly survey |

---

## 7. Product Roadmap

### Q1 – MVP Launch
- Auth system
- Adaptive test engine (4 modules)
- Scoring engine
- Student dashboard (basic)
- Question Bank CMS

### Q2 – Intelligence Layer
- AI recommendation engine
- Counsellor dashboard
- Advanced analytics (time analysis, trends)
- PDF score reports

### Q3 – Scale & Engagement
- Admin portal (full)
- Notification system
- Study plan generator
- Performance optimisation for 50K users

### Q4 – Growth
- Mobile responsive refinement
- Leaderboards
- Parent portal (view-only)
- API for third-party integrations

---

## 8. Constraints

| Constraint | Detail |
|-----------|--------|
| Timeline | MVP in 3 months |
| Tech Stack | React, FastAPI, PostgreSQL, AWS (fixed) |
| Budget | Cloud costs must stay under $2K/month at 4K users |
| Compliance | No PII stored in logs |
