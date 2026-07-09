from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from database import get_db
from models import User, Resume, Job, SavedJob, Application, JobSource, SponsorshipStatus
from routes.auth import get_current_user
from services.matcher import matcher

router = APIRouter()

# Pydantic schemas
class MatchedJobResponse(BaseModel):
    id: int
    title: str
    company: str
    location: str
    salary_min: float
    salary_max: float
    job_type: str
    match_score: float
    matched_skills: List[str]
    missing_skills: List[str]
    required_skills: List[str]
    nice_to_have_skills: List[str]
    is_saved: bool = False
    is_applied: bool = False
    source: JobSource = JobSource.INTERNAL
    apply_url: Optional[str] = None
    sponsorship: SponsorshipStatus = SponsorshipStatus.NOT_MENTIONED

    class Config:
        from_attributes = True

class MatchedCandidateResponse(BaseModel):
    id: int
    email: str
    name: str
    match_score: float
    matched_skills: List[str]
    missing_skills: List[str]
    # nullable columns on Resume, so optional here too
    experience_years: Optional[int] = None
    education: Optional[str] = None
    resume_id: int

# Routes
@router.get("/jobs", response_model=List[MatchedJobResponse])
async def get_matched_jobs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get jobs matched to user's resume (ranked by match score)"""
    
    # Get user's resume
    resume = db.query(Resume).filter(Resume.user_id == current_user.id).first()
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload a resume first"
        )
    
    # Get all active jobs
    jobs = db.query(Job).filter(Job.is_active == True).all()
    
    # Calculate match for each job
    matched_jobs = []
    
    for job in jobs:
        match_result = matcher.match_job(
            user_skills=resume.skills,
            job_required_skills=job.required_skills,
            job_nice_to_have=job.nice_to_have_skills,
            user_experience_years=resume.experience_years,
            job_experience_level=job.experience_level,
            user_resume_text=resume.summary,
            job_description_text=job.description
        )

        # Check if saved or applied
        is_saved = db.query(SavedJob).filter(
            SavedJob.user_id == current_user.id,
            SavedJob.job_id == job.id
        ).first() is not None
        
        is_applied = db.query(Application).filter(
            Application.user_id == current_user.id,
            Application.job_id == job.id
        ).first() is not None
        
        matched_jobs.append(MatchedJobResponse(
            id=job.id,
            title=job.title,
            company=job.company,
            location=job.location,
            salary_min=job.salary_min or 0,
            salary_max=job.salary_max or 0,
            job_type=job.job_type,
            match_score=match_result["match_score"],
            matched_skills=match_result["matched_skills"],
            missing_skills=match_result["missing_skills"],
            required_skills=job.required_skills,
            nice_to_have_skills=job.nice_to_have_skills,
            is_saved=is_saved,
            is_applied=is_applied,
            source=job.source,
            apply_url=job.apply_url,
            sponsorship=job.sponsorship
        ))
    
    # Sort by match score
    matched_jobs.sort(key=lambda x: x.match_score, reverse=True)
    
    return matched_jobs

@router.get("/candidates/{job_id}", response_model=List[MatchedCandidateResponse])
async def get_matched_candidates(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get candidates matched to a job (employer only, ranked by match score)"""
    
    # Get job
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    # Check permission
    if job.employer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view candidates for your own jobs"
        )
    
    # Get all resumes
    resumes = db.query(Resume).all()
    
    matched_candidates = []
    
    for resume in resumes:
        # Skip if no user
        user = db.query(User).filter(User.id == resume.user_id).first()
        if not user:
            continue
        
        match_result = matcher.match_job(
            user_skills=resume.skills,
            job_required_skills=job.required_skills,
            job_nice_to_have=job.nice_to_have_skills,
            user_experience_years=resume.experience_years,
            job_experience_level=job.experience_level,
            user_resume_text=resume.summary,
            job_description_text=job.description
        )

        # Only include if match score > 50%
        if match_result["match_score"] >= 50:
            matched_candidates.append(MatchedCandidateResponse(
                id=user.id,
                email=user.email,
                name=user.name,
                match_score=match_result["match_score"],
                matched_skills=match_result["matched_skills"],
                missing_skills=match_result["missing_skills"],
                experience_years=resume.experience_years,
                education=resume.education,
                resume_id=resume.id
            ))
    
    # Sort by match score
    matched_candidates.sort(key=lambda x: x.match_score, reverse=True)
    
    return matched_candidates

@router.post("/jobs/{job_id}/save")
async def save_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save a job"""
    
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    # Check if already saved
    existing = db.query(SavedJob).filter(
        SavedJob.user_id == current_user.id,
        SavedJob.job_id == job_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job already saved"
        )
    
    saved_job = SavedJob(user_id=current_user.id, job_id=job_id)
    db.add(saved_job)
    db.commit()
    
    return {"message": "Job saved successfully"}

@router.delete("/jobs/{job_id}/save")
async def unsave_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unsave a job"""
    
    saved_job = db.query(SavedJob).filter(
        SavedJob.user_id == current_user.id,
        SavedJob.job_id == job_id
    ).first()
    
    if not saved_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved job not found"
        )
    
    db.delete(saved_job)
    db.commit()
    
    return {"message": "Job removed from saved"}

@router.get("/saved-jobs", response_model=List[MatchedJobResponse])
async def get_saved_jobs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's saved jobs"""
    
    saved_jobs = db.query(SavedJob).filter(
        SavedJob.user_id == current_user.id
    ).all()
    
    jobs = []
    for saved in saved_jobs:
        job = db.query(Job).filter(Job.id == saved.job_id).first()
        if job:
            # Get user's resume for match score
            resume = db.query(Resume).filter(Resume.user_id == current_user.id).first()
            
            if resume:
                match_result = matcher.match_job(
                    user_skills=resume.skills,
                    job_required_skills=job.required_skills,
                    job_nice_to_have=job.nice_to_have_skills,
                    user_experience_years=resume.experience_years,
                    job_experience_level=job.experience_level,
                    user_resume_text=resume.summary,
                    job_description_text=job.description
                )
                match_score = match_result["match_score"]
                matched_skills = match_result["matched_skills"]
                missing_skills = match_result["missing_skills"]
            else:
                match_score = 0
                matched_skills = []
                missing_skills = job.required_skills
            
            jobs.append(MatchedJobResponse(
                id=job.id,
                title=job.title,
                company=job.company,
                location=job.location,
                salary_min=job.salary_min or 0,
                salary_max=job.salary_max or 0,
                job_type=job.job_type,
                match_score=match_score,
                matched_skills=matched_skills,
                missing_skills=missing_skills,
                required_skills=job.required_skills,
                nice_to_have_skills=job.nice_to_have_skills,
                is_saved=True,
                is_applied=False,
                source=job.source,
                apply_url=job.apply_url,
                sponsorship=job.sponsorship
            ))
    
    return jobs
