import os
import logging
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from app.core.config import settings
from app.core.database import engine, Base
from app.routers import auth, users, tests, analytics, recommendations, admin, coach

# Setup logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Auto-create database tables on startup (robust fallback)
try:
    logger.info("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")
    
    # Run migrations dynamically for new columns
    from sqlalchemy import text
    with engine.begin() as conn:
        logger.info("Running dynamic database column migrations...")
        conn.execute(text("ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS xp_points INTEGER DEFAULT 0"))
        conn.execute(text("ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS streak_days INTEGER DEFAULT 0"))
        conn.execute(text("ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS last_active_date DATE NULL"))
        conn.execute(text("ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS learning_style VARCHAR(100) DEFAULT 'Visual & Practical'"))
        conn.execute(text("ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS preferred_study_time VARCHAR(100) DEFAULT 'Evening (6 PM - 9 PM)'"))
        conn.execute(text("ALTER TABLE session_answers ADD COLUMN IF NOT EXISTS mistake_type VARCHAR(100) NULL"))
        conn.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS difficulty_score INTEGER DEFAULT 50"))
        conn.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS common_misconception TEXT NULL"))
        conn.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS related_concept TEXT NULL"))
        
        # User Approval Columns
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) NOT NULL DEFAULT 'Pending'"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by VARCHAR(36)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS rejection_reason TEXT"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_notes TEXT"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_ip VARCHAR(50)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_user_agent VARCHAR(500)"))
        
        # Ensure default test users are Approved
        conn.execute(text("UPDATE users SET approval_status = 'Approved' WHERE email IN ('admin@satprepai.com', 'counsellor@satprepai.com', 'student@satprepai.com', 'kumarsoniravi705@gmail.com') AND (approval_status IS NULL OR approval_status = 'Pending')"))
        
        # System Settings Table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS system_settings (
                key VARCHAR(100) PRIMARY KEY,
                value TEXT NOT NULL,
                description VARCHAR(255),
                updated_at TIMESTAMP
            )
        """))
        
        # Adaptive Logs Table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS adaptive_logs (
                id VARCHAR(36) PRIMARY KEY,
                session_id VARCHAR(36) NOT NULL,
                question_id VARCHAR(36) NOT NULL,
                question_number INTEGER NOT NULL,
                ability_before INTEGER NOT NULL,
                ability_after INTEGER NOT NULL,
                question_difficulty INTEGER NOT NULL,
                selection_reason TEXT,
                topic_name VARCHAR(255),
                time_taken_seconds INTEGER,
                is_correct BOOLEAN,
                created_at TIMESTAMP
            )
        """))
        
    # Run test_sessions alters in separate blocks to avoid transaction rollback if columns exist
    for col, ctype in [
        ("ability_score", "INTEGER DEFAULT 500"),
        ("ability_score_reading", "INTEGER DEFAULT 500"),
        ("ability_score_math", "INTEGER DEFAULT 500"),
        ("current_question_no", "INTEGER DEFAULT 1"),
        ("questions_list", "TEXT"),
        ("topic_counts", "TEXT")
    ]:
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE test_sessions ADD COLUMN {col} {ctype}"))
        except Exception:
            pass # Column already exists
            
    logger.info("Dynamic migrations completed successfully.")
except Exception as e:
    logger.error(f"Error initializing database tables: {e}")

app = FastAPI(
    title="SATPrep AI API",
    description="Adaptive Mock Test Portal for the Digital SAT",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Rate Limiting Simulation / Middleware
@app.middleware("http")
async def rate_limiting_middleware(request: Request, call_next):
    # Standard 100 requests per minute per IP limit simulation
    # For local/testing we pass through cleanly, but logging can be added
    response = await call_next(request)
    # Add Security headers as required by security docs
    # Note: Commented out X-Frame-Options DENY to allow framing in Hugging Face Spaces.
    # response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    # Explicitly configure Content-Security-Policy to allow framing in Hugging Face Spaces
    response.headers["Content-Security-Policy"] = "frame-ancestors 'self' https://huggingface.co https://*.hf.space;"
    
    # Force cache-busting to prevent browser caching of old security headers (like X-Frame-Options: DENY)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    
    return response

# Include V1 Routers
app.include_router(auth.router, prefix="/v1")
app.include_router(users.router, prefix="/v1")
app.include_router(tests.router, prefix="/v1")
app.include_router(analytics.router, prefix="/v1")
app.include_router(recommendations.router, prefix="/v1")
app.include_router(admin.router, prefix="/v1")
app.include_router(coach.router, prefix="/v1")

# Health Check Route
@app.get("/healthz")
@app.get("/v1/health")
def health_check():
    return {"status": "healthy", "env": settings.ENV}

# Production Static Files mounting
frontend_dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/dist"))

if os.path.exists(frontend_dist_path):
    logger.info(f"Serving frontend assets from: {frontend_dist_path}")
    # Mount assets folder first
    assets_path = os.path.join(frontend_dist_path, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")
        
    # Catch-all route to serve index.html or other static files from frontend/dist
    @app.get("/{catchall:path}")
    def serve_frontend(catchall: str):
        # Allow API docs and openapi JSON to pass through
        if catchall.startswith("docs") or catchall.startswith("redoc") or catchall.startswith("openapi.json"):
            raise HTTPException(status_code=404)
        
        # Check if the requested file exists in frontend_dist_path (e.g. vite.svg, favicon.ico)
        if catchall:
            file_path = os.path.join(frontend_dist_path, catchall)
            if os.path.exists(file_path) and os.path.isfile(file_path):
                return FileResponse(file_path)
                
        index_file = os.path.join(frontend_dist_path, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"message": "SATPrep AI API is running"}
else:
    logger.warning("Frontend build folder 'frontend/dist' not found. API mode only.")
    @app.get("/")
    def index():
        return {"message": "SATPrep AI API is running. Build frontend/dist to serve UI."}
