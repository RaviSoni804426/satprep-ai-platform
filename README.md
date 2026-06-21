# SATPrep AI – Adaptive Mock Test Portal for the Digital SAT

SATPrep AI is a cloud-native, enterprise-grade mock test portal designed to replicate the official College Board Digital SAT experience. Featuring real-time adaptive module routing, precise Item Response Theory (IRT) based score scaling, AI-driven study recommendations, and a dedicated counsellor dashboard, the platform is built to scale from 4,000 to over 50,000 active students.

---

## Key Features

### 1. Realistic Test Player
- **Adaptive Routing**: Implements the Digital SAT algorithm. Depending on the student's performance in Module 1, they are routed to either the Easy or Hard path in Module 2.
- **Tools**: Features a custom canvas-based scientific/graphing calculator (allowing plotting of equations) and a formula reference pop-up.
- **Auto-Save & Resume**: State is automatically synced to Redis and persisted to the database every 30 seconds, allowing instant recovery from network interruptions.

### 2. Analytics & AI Recommendations
- **Grading & Curves**: Multi-path score curves mapping raw answers to scaled SAT scores (200–800 per section) with confidence bands (±30 points).
- **Skill Breakdown**: Topic-level accuracy calculations across SAT domains (e.g., Algebra, Geometry, Craft & Structure).
- **Recommendations**: Dynamically generates practice problem sets targeting weak areas, creates 7-day custom calendars, and schedules mock exam cadences.

### 3. Counsellor & Admin Dashboard
- **Roster & Readiness**: Counsellors track student averages, score trends, and color-coded readiness status (`✅ Ready`, `⚠️ Almost Ready`, `🔴 Needs Work`).
- **Question Bank CMS**: Full CRUD operations for questions, manual approval flows for content authors, and bulk question importing via CSV.
- **Exporting**: Platform reports generated dynamically and exported as CSV downloads.

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Redux Toolkit, React Router v6, Recharts, Lucide Icons.
- **Backend**: FastAPI (Python 3.11), SQLAlchemy, Alembic, Pydantic v2.
- **Database**: PostgreSQL (relational storage).
- **Cache & Sessions**: Redis (TTL keys for OTP codes and active test states).
- **Containerization**: Docker, Docker Compose.

---

## Folder Structure

```
satprep-ai-platform/
├── backend/
│   ├── app/
│   │   ├── core/           # Configuration, security, and database sessions
│   │   ├── models/         # SQLAlchemy database models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── repository/     # Database CRUD (Repository Pattern)
│   │   ├── services/       # Core business logic (Scoring, Routing, AI)
│   │   ├── routers/        # FastAPI endpoints (Auth, Tests, Admin, Analytics)
│   │   ├── tasks/          # Background scoring workers
│   │   └── main.py         # Entry point
│   ├── tests/              # Pytest unit & integration suites
│   ├── alembic/            # Database migrations
│   └── requirements.txt    # Python packages
├── frontend/
│   ├── src/
│   │   ├── assets/         # CSS and tailwind directives
│   │   ├── components/     # UI elements (Timer, Calculator, Formula Sheet)
│   │   ├── pages/          # Login, Student, Counsellor, and Admin views
│   │   ├── store/          # Redux auth state
│   │   ├── services/       # REST API fetch client
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── docker/
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   ├── hf.Dockerfile       # Unified space container
│   └── nginx.conf          # Router fallback rules
├── scripts/
│   ├── seed_db.py          # Prepopulates questions and test modules
│   └── start_hf.sh         # Hugging Face deployment bootstrap
├── docker-compose.yml      # Local orchestrator
└── README.md
```

---

## Environment Variables

Create a `.env` file in the root folder (or backend directory) containing:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/satprep
REDIS_URL=redis://localhost:6379/0
JWT_SECRET_KEY=yoursupersecretkeyforgeneratingandverifyingtokens
ENV=development
OTP_BYPASS=True
```

---

## Local Setup

### Option A: Run with Docker Compose (Recommended)
Make sure you have Docker installed, then run:
```bash
docker compose up --build
```
This builds and launches the database, cache, backend server, and frontend client:
- **Frontend Client**: `http://localhost:3000`
- **Backend API Docs**: `http://localhost:8000/docs`

### Option B: Manual Setup

1. **Prerequisites**: Install Python 3.11+, Node.js 20+, PostgreSQL 15+, and Redis.
2. **Start Backend**:
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
3. **Seed Database**:
   ```bash
   python scripts/seed_db.py
   ```
4. **Start Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Default Accounts
Use the following seed credentials to log in:
- **Student**: `student@satprepai.com` / `StudentPass123!`
- **Counsellor**: `counsellor@satprepai.com` / `CounsellorPass123!`
- **Admin**: `admin@satprepai.com` / `AdminPass123!`

---

## Automated Testing

Run the test suite using `pytest`:
```bash
cd backend
pytest tests/
```

---

## Deployment on Hugging Face Spaces (Docker Space)

This project is optimized for deployment as a Hugging Face Space using the single-container `docker/hf.Dockerfile`. 

1. Create a **New Space** on Hugging Face.
2. Select **Docker** as the SDK.
3. Push the files to your Hugging Face Space repository.
4. Hugging Face will build the space automatically. The single container launches PostgreSQL, Redis, sets up database migrations, seeds the default SAT test questions, compiles the frontend static bundle, and serves the portal on Hugging Face's default port (`7860`).
