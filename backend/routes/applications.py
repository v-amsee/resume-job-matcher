from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from database import get_db
from models import User, Application, Resume, Job, ApplicationStatus
from routes.auth import get_current_user

router = APIRouter()

# Pydantic schemas
class ApplicationCreate(BaseModel):
    job_id: int
    resume_id: Optional[int] = None

class ApplicationUpdate(BaseModel):
    status: Optional[ApplicationStatus] = None
    interview_date: Optional[datetime] = None
    interview_link: Optional[str] = None
    notes: Optional[str] = None

class ApplicationResponse(BaseModel):
    id: int
    user_id: int
    job_id: int
    status: ApplicationStatus
    match_score: Optional[float]
    matched_skills: List[str]
    missing_skills: List[str]
    interview_date: Optional[datetime]
    interview_link: Optional[str]
    applied_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ApplicationDetailResponse(ApplicationResponse):
    job: dict
    user: dict
    resume: dict

class InterviewSchedule(BaseModel):
    interview_date: datetime
    interview_link: str

# Routes
@router.post("/", response_model=ApplicationResponse)
async def create_application(
    app_data: ApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Apply for a job"""
    
    # Get job
    job = db.query(Job).filter(Job.id == app_data.job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    if not job.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This job is no longer active"
        )
    
    # Check if already applied
    existing = db.query(Application).filter(
        Application.user_id == current_user.id,
        Application.job_id == app_data.job_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already applied for this job"
        )
    
    # Get user's resume
    resume = db.query(Resume).filter(Resume.user_id == current_user.id).first()
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload a resume before applying"
        )
    
    # Calculate match score
    from services.matcher import matcher
    
    match_result = matcher.match_job(
        user_skills=resume.skills,
        job_required_skills=job.required_skills,
        job_nice_to_have=job.nice_to_have_skills,
        user_experience_years=resume.experience_years,
        job_experience_level=job.experience_level,
        user_resume_text=resume.summary,
        job_description_text=job.description
    )
    
    # Create application
    db_application = Application(
        user_id=current_user.id,
        job_id=app_data.job_id,
        status=ApplicationStatus.APPLIED,
        match_score=match_result["match_score"],
        matched_skills=match_result["matched_skills"],
        missing_skills=match_result["missing_skills"]
    )
    
    db.add(db_application)
    db.commit()
    db.refresh(db_application)
    
    return ApplicationResponse.from_orm(db_application)

@router.get("/my-applications", response_model=List[ApplicationResponse])
async def get_my_applications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's applications"""
    applications = db.query(Application).filter(
        Application.user_id == current_user.id
    ).order_by(Application.applied_at.desc()).all()
    
    return applications

@router.get("/{application_id}", response_model=ApplicationResponse)
async def get_application(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get application details"""
    application = db.query(Application).filter(
        Application.id == application_id
    ).first()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )
    
    # Check permissions
    if application.user_id != current_user.id:
        # Check if user is employer for this job
        job = db.query(Job).filter(Job.id == application.job_id).first()
        if not job or job.employer_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to view this application"
            )
    
    return ApplicationResponse.from_orm(application)

@router.put("/{application_id}", response_model=ApplicationResponse)
async def update_application(
    application_id: int,
    app_data: ApplicationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update application status (employer only)"""
    
    application = db.query(Application).filter(
        Application.id == application_id
    ).first()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )
    
    # Check permission (must be job employer)
    job = db.query(Job).filter(Job.id == application.job_id).first()
    if job.employer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update applications for your own jobs"
        )
    
    # Update fields
    update_data = app_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(application, field, value)
    
    application.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(application)
    
    return ApplicationResponse.from_orm(application)

@router.delete("/{application_id}")
async def withdraw_application(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Withdraw application (candidate only)"""
    
    application = db.query(Application).filter(
        Application.id == application_id
    ).first()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )
    
    if application.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only withdraw your own applications"
        )
    
    db.delete(application)
    db.commit()
    
    return {"message": "Application withdrawn successfully"}

@router.post("/{application_id}/schedule-interview")
async def schedule_interview(
    application_id: int,
    schedule_data: InterviewSchedule,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Schedule interview with candidate"""

    application = db.query(Application).filter(
        Application.id == application_id
    ).first()

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )

    # Check permission
    job = db.query(Job).filter(Job.id == application.job_id).first()
    if job.employer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only schedule interviews for your own jobs"
        )

    application.status = ApplicationStatus.INTERVIEW_SCHEDULED
    application.interview_date = schedule_data.interview_date
    application.interview_link = schedule_data.interview_link
    application.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(application)
    
    return {
        "message": "Interview scheduled successfully",
        "application": ApplicationResponse.from_orm(application)
    }
