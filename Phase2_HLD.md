# High Level Design (HLD)
## SATPrep AI – Adaptive Mock Test Portal for the Digital SAT

---

## 1. Architecture Overview

**Pattern:** Microservices-oriented monolith (modular monolith on FastAPI, separated by domain service layer)

**Deployment:** AWS ECS (containers), RDS (PostgreSQL), ElastiCache (Redis), CloudFront (CDN)

```
[Browser / Client]
       ↓ HTTPS
[CloudFront CDN]
       ↓
[Application Load Balancer]
       ↓
[ECS Cluster - FastAPI Services]
  ├── Auth Service
  ├── Test Engine Service
  ├── Scoring Service
  ├── Analytics Service
  ├── Recommendation Service
  └── Admin Service
       ↓
[PostgreSQL (RDS)]  [Redis (ElastiCache)]  [S3 (Storage)]
       ↓
[RabbitMQ - Async Jobs]
       ↓
[Elasticsearch - Search]
```

---

## 2. Components

### 2.1 Frontend (React + TypeScript)
- Single Page Application
- Redux Toolkit for state management
- Tailwind CSS for styling
- Hosted via CloudFront + S3 static hosting
- Communicates with backend via REST APIs

### 2.2 Backend (FastAPI)

| Service | Responsibility |
|---------|---------------|
| Auth Service | Login, JWT, OTP, RBAC |
| Test Engine Service | Start test, serve questions, adaptive routing |
| Scoring Service | Calculate scores, generate reports |
| Analytics Service | Aggregate performance data |
| Recommendation Service | AI-based study suggestions |
| Admin Service | User, question, test management |

### 2.3 Database (PostgreSQL on RDS)
- Primary DB for all persistent data
- Read replicas for analytics queries
- Multi-AZ for high availability

### 2.4 Cache (Redis on ElastiCache)
- Active test sessions (questions, timer state)
- User JWT token validation cache
- Leaderboard / frequently accessed student data

### 2.5 Storage (AWS S3)
- Test state auto-saves (JSON snapshots)
- Score report PDFs
- Question media (images, passages)
- Audit logs archive

### 2.6 Message Queue (RabbitMQ)
- Async score calculation after test submission
- AI recommendation generation (non-blocking)
- Email/notification dispatch
- Analytics event processing

### 2.7 Search (Elasticsearch)
- Question search by topic, difficulty, tags
- Student search in admin/counsellor views

---

## 3. Deployment Architecture

```
Region: ap-south-1 (Mumbai)

VPC
├── Public Subnet
│   └── Application Load Balancer
├── Private Subnet - App
│   └── ECS Cluster (Auto-scaling group)
│       ├── FastAPI containers (min 2, max 10)
│       └── RabbitMQ worker containers
├── Private Subnet - Data
│   ├── RDS PostgreSQL (Multi-AZ)
│   ├── ElastiCache Redis (Cluster mode)
│   └── Elasticsearch domain
└── S3 Buckets (region-scoped)

CloudFront → S3 (React build)
CloudFront → ALB (API calls)
CloudWatch → Logs, Metrics, Alarms
GitHub Actions → ECR → ECS (CI/CD)
```

---

## 4. Data Flow – Test Session

```
1. Student clicks "Start Test"
2. Test Engine creates session → stores in Redis + PostgreSQL
3. Questions served from PostgreSQL (by test form)
4. Answers auto-saved to Redis every 30s → flushed to S3 snapshot
5. Module 1 submitted → Scoring Service calculates raw score
6. Routing Service determines Module 2 difficulty
7. Module 2 questions served
8. All 4 modules complete → Scoring Service generates final report
9. RabbitMQ fires:
   - Analytics aggregation job
   - Recommendation generation job
   - PDF report generation job
10. Student dashboard updated
```

---

## 5. Security Architecture

| Layer | Control |
|-------|---------|
| Transport | TLS 1.3 enforced |
| Auth | JWT (access 15min, refresh 7d) + OTP |
| API | Rate limiting (100 req/min per user) |
| Data | AES-256 encryption at rest (RDS, S3) |
| Network | VPC private subnets, Security Groups |
| App | OWASP Top 10 controls, input validation |
| Audit | All admin actions logged to S3 |

---

## 6. Scalability Strategy

| Concern | Solution |
|---------|---------|
| 500+ concurrent users | ECS auto-scaling (CPU > 70% trigger) |
| DB read load | RDS read replicas for analytics |
| Session state | Redis cluster (sharded) |
| File delivery | CloudFront CDN (global edge) |
| Peak load (exam season) | Pre-warm ECS capacity via scheduled scaling |

---

## 7. Technology Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Redux Toolkit |
| Backend | FastAPI (Python 3.11) |
| Database | PostgreSQL 15 (AWS RDS) |
| Cache | Redis 7 (AWS ElastiCache) |
| Queue | RabbitMQ |
| Search | Elasticsearch 8 |
| Storage | AWS S3 |
| CDN | AWS CloudFront |
| Container | Docker, AWS ECS (Fargate) |
| CI/CD | GitHub Actions → ECR → ECS |
| Monitoring | AWS CloudWatch, Sentry |
