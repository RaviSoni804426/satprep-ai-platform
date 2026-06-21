# UI/UX Documentation
## SATPrep AI – Adaptive Mock Test Portal for the Digital SAT

---

## 1. Design Principles

| Principle | Application |
|-----------|------------|
| Clarity | No distractions during test; one task per screen |
| Feedback | Every action confirmed (saved, flagged, submitted) |
| Consistency | Same header/footer pattern across all dashboards |
| Accessibility | WCAG 2.1 AA; keyboard navigable; ARIA labels |
| Responsiveness | Desktop-first; mobile-friendly layout |

**Design Tokens:**
- Primary: `#1D4ED8` (Blue)
- Success: `#16A34A` (Green)
- Warning: `#D97706` (Amber)
- Danger: `#DC2626` (Red)
- Background: `#F9FAFB`
- Font: Inter (UI), Georgia (passage text)

---

## 2. Screen Specifications

---

### Screen 1: Login Page

**Route:** `/login`  
**Access:** Public

**Layout:**
```
┌──────────────────────────────────┐
│          SATPrep AI Logo         │
│                                  │
│   [Email Input]                  │
│   [Password Input]               │
│   [Login Button]                 │
│                                  │
│   ─────── or ───────             │
│   [Continue with Google]         │
│                                  │
│   Don't have an account? Sign Up │
└──────────────────────────────────┘
```

**Behaviour:**
- Show/hide password toggle
- Inline validation on blur
- Google OAuth redirect → callback → dashboard
- On success → redirect to role-based dashboard

---

### Screen 2: OTP Verification

**Route:** `/auth/verify`

**Layout:**
```
┌──────────────────────────────────┐
│   Enter the 6-digit code         │
│   sent to arjun@email.com        │
│                                  │
│   [ _ ] [ _ ] [ _ ] [ _ ] [ _ ] [ _ ]  │
│                                  │
│   [Verify]                       │
│   Resend OTP (0:45 countdown)    │
└──────────────────────────────────┘
```

**Behaviour:**
- Auto-focus next box on input
- Auto-submit on 6th digit
- Resend enabled after 60s countdown
- 3 failed attempts → lock for 5 min

---

### Screen 3: Student Dashboard

**Route:** `/dashboard`

**Layout:**
```
┌─ Header: Logo | Nav | Avatar ────────────────────┐
│                                                   │
│  👋 Welcome back, Arjun                           │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Latest   │  │ Best     │  │ Tests Taken  │   │
│  │ 1320     │  │ 1410     │  │ 5            │   │
│  └──────────┘  └──────────┘  └──────────────┘   │
│                                                   │
│  Score Trend (line chart, last 6 attempts)        │
│                                                   │
│  Weak Topics        │  AI Recommendations         │
│  • Craft & Structure│  📚 Practice Set: Algebra   │
│  • Geometry         │  📅 Next Mock: Jan 22       │
│                     │  🗓️ Study Plan Ready         │
│                                                   │
│  [Start New Mock Test]  [View History]            │
└───────────────────────────────────────────────────┘
```

**Components:**
- Score stat cards (3)
- Line chart (Recharts)
- Weak topic list (max 3 shown)
- Recommendation cards (dismissible)
- CTA buttons

---

### Screen 4: Test Player

**Route:** `/test/{session_id}`

**Layout:**
```
┌─ Top Bar ─────────────────────────────────────────┐
│  Module 2: Math (Hard)  │  Q 14 / 22  │ ⏱ 28:44  │
└───────────────────────────────────────────────────┘
│                                                   │
│  Question 14                          [🚩 Flag]   │
│  ─────────────────────────────────               │
│  If f(x) = 3x² + 2x − 5, what is f(3)?          │
│                                                   │
│  ○ A) 24                                          │
│  ○ B) 28                                          │
│  ● C) 30   ← selected                            │
│  ○ D) 34                                          │
│                                                   │
│                                                   │
│ [← Prev]  [Question Navigator]  [Next →]         │
│                                                   │
│ [Submit Module]                                   │
└───────────────────────────────────────────────────┘
```

**Behaviour:**
- Timer turns red at < 5 min
- Flagged questions shown in amber in navigator
- Unanswered questions shown in grey
- Submit requires confirmation modal
- Auto-submit + toast on timer expiry
- Calculator icon (Math only) → Desmos modal
- Formula sheet icon (Math only) → modal overlay
- Highlight tool (Reading only) → tooltip on select

---

### Screen 5: Score Report

**Route:** `/sessions/{session_id}/score`

**Layout:**
```
┌──────────────────────────────────────────────────┐
│  📊 Your SAT Score Report                        │
│  Mock SAT #5 · Jan 15, 2025                      │
│                                                  │
│  ┌──────────────────────────────────┐            │
│  │    Total Score: 1420             │            │
│  │    Range: 1390 – 1450            │            │
│  │  Reading: 680  │  Math: 740      │            │
│  └──────────────────────────────────┘            │
│                                                  │
│  Skill Breakdown (radar/bar chart)               │
│  ┌─────────────────────────────────┐             │
│  │ Algebra          ████████ 88%   │             │
│  │ Geometry         ██████   72%   │             │
│  │ Info & Ideas     █████████ 91%  │             │
│  │ Craft & Structure████   65%     │             │
│  └─────────────────────────────────┘             │
│                                                  │
│  Weak Areas: Craft & Structure, Geometry         │
│                                                  │
│  [View Answer Review]  [Download PDF]  [Home]   │
└──────────────────────────────────────────────────┘
```

---

### Screen 6: Answer Review

**Route:** `/sessions/{session_id}/review`

**Layout:**
- Question listed with: your answer | correct answer | explanation
- Filter: All / Correct / Wrong / Flagged
- Topic label on each question
- Time taken per question shown

---

### Screen 7: Counsellor Dashboard

**Route:** `/counsellor/dashboard`

**Layout:**
```
┌─ Header ──────────────────────────────────────────┐
│  My Students (42)       [Search]  [Export CSV]    │
│                                                   │
│  ┌──────────────────────────────────────────────┐ │
│  │ Name       | Latest | Best | Trend | Status  │ │
│  │ Arjun S.   | 1320   | 1410 |  ↑    | Ready  │ │
│  │ Priya M.   | 1100   | 1150 |  →    | Needs  │ │
│  │ Rahul K.   | 980    | 1050 |  ↓    | At Risk│ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│  [Click student → detailed view]                  │
└───────────────────────────────────────────────────┘
```

**Readiness Labels:**
- ✅ Ready — Latest score ≥ target
- ⚠️ Almost Ready — Within 100 pts of target
- 🔴 Needs Work — > 100 pts below target

---

### Screen 8: Admin Portal

**Route:** `/admin`

**Tabs:**
- **Users** — List, filter by role, activate/deactivate, assign counsellor
- **Questions** — Review pending, approve/reject, edit
- **Tests** — Create test, assign modules, activate/deactivate
- **Analytics** — Platform KPIs, completion rates, score distribution
- **Reports** — Export by date range, type

---

## 3. Responsive Behaviour

| Breakpoint | Layout Adjustment |
|-----------|------------------|
| Desktop (1280px+) | 2-column layouts, full sidebar |
| Tablet (768px–1279px) | Single column, collapsible nav |
| Mobile (< 768px) | Stacked cards, hamburger menu |

**Test Player on Mobile:**
- Question and options stacked vertically
- Navigator collapses to a summary bar at bottom
- Timer always visible as sticky top bar

---

## 4. Key UX Flows

### 4.1 First-Time Student
```
Register → OTP Verify → Profile Setup (target score, test date) → Dashboard → Take Mock
```

### 4.2 Returning Student
```
Login → Dashboard → See AI Recommendations → Start Mock or Do Practice Set
```

### 4.3 Counsellor
```
Login → Counsellor Dashboard → Select Student → View Detailed Analytics → Export Report
```

### 4.4 Test Resume
```
Network drop during test → Return to /test/{session_id} → Resume modal → Restore from exact point
```
