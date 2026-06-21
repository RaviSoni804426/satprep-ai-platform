import os
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from app.core.config import settings
from app.core.database import engine, Base
from app.routers import auth, users, tests, analytics, recommendations, admin

# Setup logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Auto-create database tables on startup (robust fallback)
try:
    logger.info("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")
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
    return response

# Include V1 Routers
app.include_router(auth.router, prefix="/v1")
app.include_router(users.router, prefix="/v1")
app.include_router(tests.router, prefix="/v1")
app.include_router(analytics.router, prefix="/v1")
app.include_router(recommendations.router, prefix="/v1")
app.include_router(admin.router, prefix="/v1")

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
        
    # Catch-all route to serve index.html for client-side routing
    @app.get("/{catchall:path}")
    def serve_frontend(catchall: str):
        # Allow API docs and openapi JSON to pass through
        if catchall.startswith("docs") or catchall.startswith("redoc") or catchall.startswith("openapi.json"):
            raise HTTPException(status_code=404)
        index_file = os.path.join(frontend_dist_path, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"message": "SATPrep AI API is running"}
else:
    logger.warning("Frontend build folder 'frontend/dist' not found. API mode only.")
    @app.get("/")
    def index():
        return {"message": "SATPrep AI API is running. Build frontend/dist to serve UI."}
