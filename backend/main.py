from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from datetime import datetime, timedelta
import json
import os

# Load environment variables
load_dotenv()

# Import routes
from routes import auth, resumes, jobs, applications, matching
from database import init_db
from data.sync_jobs import sync as sync_external_jobs, SOURCES as JOB_SYNC_SOURCES

# Initialize FastAPI app
app = FastAPI(
    title="Resume Parser & Job Matcher API",
    description="AI-powered resume parsing and job matching platform",
    version="1.0.0"
)


def _get_cors_origins():
    """CORS_ORIGINS can be a JSON array or a comma-separated list, falls
    back to local dev origins if it's not set."""
    raw = os.getenv("CORS_ORIGINS")
    if not raw:
        return ["http://localhost:5173", "http://localhost:3000"]
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # needed or the browser hides X-Total-Count from the frontend's JS (used for pagination)
    expose_headers=["X-Total-Count"],
)


# Runs sync_jobs.sync() on a timer, in-process. BackgroundScheduler (thread
# based, not asyncio) since the sync itself makes blocking httpx calls that
# would otherwise stall the whole event loop.
scheduler = BackgroundScheduler()


def _run_scheduled_sync():
    print("[scheduler] Starting scheduled job sync...")
    try:
        sync_external_jobs(list(JOB_SYNC_SOURCES.keys()))
    except Exception as e:
        print(f"[scheduler] Job sync failed: {e}")


@app.on_event("startup")
async def on_startup():
    init_db()  # creates tables if they don't exist yet

    # set ENABLE_JOB_SYNC_SCHEDULER=false to go back to running make sync-jobs by hand
    if os.getenv("ENABLE_JOB_SYNC_SCHEDULER", "true").lower() not in ("false", "0", "no"):
        interval_hours = float(os.getenv("JOB_SYNC_INTERVAL_HOURS", 24))
        scheduler.add_job(
            _run_scheduled_sync,
            "interval",
            hours=interval_hours,
            next_run_time=datetime.now() + timedelta(minutes=2),  # give the container a moment to settle first
            id="job_sync",
            replace_existing=True,
        )
        scheduler.start()
        print(f"[scheduler] Job sync scheduled every {interval_hours}h (first run in ~2 min)")


@app.on_event("shutdown")
async def on_shutdown():
    if scheduler.running:
        scheduler.shutdown(wait=False)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(resumes.router, prefix="/api/resumes", tags=["Resumes"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(applications.router, prefix="/api/applications", tags=["Applications"])
app.include_router(matching.router, prefix="/api/matching", tags=["Matching"])

# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "service": "Resume Parser & Job Matcher API"}

# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    return {
        "name": "Resume Parser & Job Matcher",
        "version": "1.0.0",
        "docs": "/docs",
        "openapi": "/openapi.json"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("ENVIRONMENT") != "production"
    )
