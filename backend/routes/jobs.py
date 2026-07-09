from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from database import get_db
from models import User, Job, UserType, Application, SavedJob, JobSource, SponsorshipStatus
from routes.auth import get_current_user, get_optional_user

router = APIRouter()

# Pydantic schemas
class JobCreate(BaseModel):
    title: str
    company: str
    description: str
    required_skills: List[str]
    nice_to_have_skills: List[str] = []
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    location: str
    job_type: str = "Full-time"
    experience_level: str = "mid"

class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    required_skills: Optional[List[str]] = None
    nice_to_have_skills: Optional[List[str]] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    location: Optional[str] = None
    job_type: Optional[str] = None
    experience_level: Optional[str] = None
    is_active: Optional[bool] = None

class JobResponse(BaseModel):
    id: int
    title: str
    company: str
    description: str
    required_skills: List[str]
    nice_to_have_skills: List[str]
    salary_min: Optional[float]
    salary_max: Optional[float]
    location: str
    job_type: str
    experience_level: str
    posted_at: datetime
    is_active: bool
    # nullable -- jobs pulled from external sources don't have an employer account
    employer_id: Optional[int] = None
    source: JobSource = JobSource.INTERNAL
    apply_url: Optional[str] = None
    sponsorship: SponsorshipStatus = SponsorshipStatus.NOT_MENTIONED
    # only set when the caller is logged in, see get_jobs below
    is_saved: bool = False
    is_applied: bool = False

    class Config:
        from_attributes = True

class EmployerJobResponse(JobResponse):
    application_count: int = 0

# Routes
@router.post("/", response_model=JobResponse)
async def create_job(
    job_data: JobCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new job posting (employer only)"""
    
    if current_user.user_type != UserType.EMPLOYER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only employers can post jobs"
        )
    
    db_job = Job(
        employer_id=current_user.id,
        title=job_data.title,
        company=job_data.company,
        description=job_data.description,
        required_skills=job_data.required_skills,
        nice_to_have_skills=job_data.nice_to_have_skills,
        salary_min=job_data.salary_min,
        salary_max=job_data.salary_max,
        location=job_data.location,
        job_type=job_data.job_type,
        experience_level=job_data.experience_level,
        source=JobSource.INTERNAL
    )
    
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    
    return JobResponse.from_orm(db_job)

@router.get("/", response_model=List[JobResponse])
async def get_jobs(
    response: Response,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    location: Optional[str] = None,
    job_type: Optional[str] = None,
    min_salary: Optional[float] = None,
    max_salary: Optional[float] = None,
    experience_level: Optional[str] = None,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Get all active jobs with filtering.

    Unlike /matching/jobs, this never requires a resume -- it's the browse-
    everything list. current_user is optional; when it's set we just attach
    is_saved/is_applied so cards render correctly for a logged-in visitor.
    """

    query = db.query(Job).filter(Job.is_active == True)

    if location:
        query = query.filter(Job.location.ilike(f"%{location}%"))
    if job_type:
        query = query.filter(Job.job_type == job_type)
    # explicit None check, not `if min_salary:` -- 0 is a valid filter value
    # and is falsy in Python, so the truthy check would silently drop it
    if min_salary is not None:
        query = query.filter(Job.salary_min >= min_salary)
    if max_salary is not None:
        query = query.filter(Job.salary_max <= max_salary)
    if experience_level:
        query = query.filter(Job.experience_level == experience_level)

    # Pagination
    total = query.count()
    response.headers["X-Total-Count"] = str(total)
    jobs = query.order_by(Job.posted_at.desc()).offset((page - 1) * limit).limit(limit).all()

    saved_ids = set()
    applied_ids = set()
    if current_user:
        saved_ids = {
            row.job_id for row in
            db.query(SavedJob.job_id).filter(SavedJob.user_id == current_user.id).all()
        }
        applied_ids = {
            row.job_id for row in
            db.query(Application.job_id).filter(Application.user_id == current_user.id).all()
        }

    results = []
    for job in jobs:
        data = JobResponse.from_orm(job).dict()
        data["is_saved"] = job.id in saved_ids
        data["is_applied"] = job.id in applied_ids
        results.append(JobResponse(**data))

    return results

@router.get("/my-jobs", response_model=List[EmployerJobResponse])
async def get_my_jobs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """All of the current employer's job postings, including inactive ones,
    with a real application count per job -- the public /jobs/ list only
    has active postings and doesn't include a count at all."""
    if current_user.user_type != UserType.EMPLOYER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only employers can view their job postings"
        )

    jobs = db.query(Job).filter(
        Job.employer_id == current_user.id
    ).order_by(Job.posted_at.desc()).all()

    results = []
    for job in jobs:
        application_count = db.query(Application).filter(
            Application.job_id == job.id
        ).count()
        results.append(
            EmployerJobResponse(
                **JobResponse.from_orm(job).dict(),
                application_count=application_count
            )
        )

    return results

@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: int, db: Session = Depends(get_db)):
    """Get job by ID"""
    job = db.query(Job).filter(Job.id == job_id).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    return JobResponse.from_orm(job)

@router.put("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: int,
    job_data: JobUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update job posting (employer only)"""
    
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    if job.employer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own jobs"
        )
    
    # Update fields
    update_data = job_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(job, field, value)
    
    job.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(job)
    
    return JobResponse.from_orm(job)

@router.delete("/{job_id}")
async def delete_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete job posting (employer only)"""
    
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    if job.employer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own jobs"
        )
    
    db.delete(job)
    db.commit()
    
    return {"message": "Job deleted successfully"}

@router.get("/{job_id}/applications", response_model=List[dict])
async def get_job_applications(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all applications for a job (employer only)"""
    
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    if job.employer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view applications for your own jobs"
        )
    
    applications = db.query(Application).filter(Application.job_id == job_id).all()
    
    return applications
