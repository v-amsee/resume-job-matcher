from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import os
import shutil
from datetime import datetime

from database import get_db
from models import User, Resume
from routes.auth import get_current_user
from services.resume_parser import parser
from services.nlp_extractor import extractor

router = APIRouter()

# Pydantic schemas
# experience_years/education are Optional since the underlying DB columns
# are nullable -- a resume where we didn't detect either shouldn't 500 on
# response validation.
class ResumeExtracted(BaseModel):
    skills: List[str]
    experience_years: Optional[int] = None
    education: Optional[str] = None
    job_titles: List[str]
    languages: List[str]
    certifications: List[str]

class ResumeResponse(BaseModel):
    id: int
    file_name: str
    skills: List[str]
    experience_years: Optional[int] = None
    education: Optional[str] = None
    job_titles: List[str]
    languages: List[str]
    certifications: List[str]
    created_at: datetime

    class Config:
        from_attributes = True

class ResumeUpdate(BaseModel):
    """Lets a user fix whatever the extractor got wrong. Everything's
    optional so a partial edit doesn't require resending the whole resume."""
    skills: Optional[List[str]] = None
    experience_years: Optional[int] = None
    education: Optional[str] = None
    job_titles: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    certifications: Optional[List[str]] = None

# Configuration
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", 10485760))  # 10MB default

os.makedirs(UPLOAD_DIR, exist_ok=True)

# Routes
@router.post("/upload", response_model=ResumeResponse)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload and parse resume"""
    
    # Validate file type
    allowed_types = {"application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF and DOCX files are allowed"
        )
    
    # Read file
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds maximum allowed size"
        )
    
    # Save file
    file_extension = os.path.splitext(file.filename)[1]
    file_path = os.path.join(UPLOAD_DIR, f"{current_user.id}_{datetime.utcnow().timestamp()}{file_extension}")
    
    with open(file_path, "wb") as f:
        f.write(contents)
    
    try:
        # Parse resume
        raw_text, cleaned_text = parser.parse(file_path)
        
        # Extract information using NLP
        extracted = extractor.extract_all(cleaned_text)
        
        # Delete old resume if exists
        old_resume = db.query(Resume).filter(Resume.user_id == current_user.id).first()
        if old_resume:
            if os.path.exists(old_resume.file_path):
                os.remove(old_resume.file_path)
            db.delete(old_resume)
        
        # Create resume record
        db_resume = Resume(
            user_id=current_user.id,
            file_path=file_path,
            file_name=file.filename,
            skills=extracted["skills"],
            experience_years=extracted["experience_years"],
            education=extracted["education"],
            job_titles=extracted["job_titles"],
            languages=extracted["languages"],
            certifications=extracted["certifications"],
            summary=cleaned_text[:500]  # First 500 chars as summary
        )
        
        db.add(db_resume)
        db.commit()
        db.refresh(db_resume)
        
        return ResumeResponse.from_orm(db_resume)
        
    except Exception as e:
        # Clean up file on error
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error parsing resume: {str(e)}"
        )

@router.get("/my-resume", response_model=ResumeResponse)
async def get_my_resume(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's resume"""
    resume = db.query(Resume).filter(Resume.user_id == current_user.id).first()
    
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No resume found. Please upload a resume."
        )
    
    return ResumeResponse.from_orm(resume)

@router.get("/{resume_id}", response_model=ResumeResponse)
async def get_resume(
    resume_id: int,
    db: Session = Depends(get_db)
):
    """Get resume by ID (for employers viewing applications)"""
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found"
        )
    
    return ResumeResponse.from_orm(resume)

@router.put("/my-resume", response_model=ResumeResponse)
async def update_resume(
    update_data: ResumeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Let the user correct fields the extractor got wrong (skills,
    experience years, education, etc.) without re-uploading the file."""
    resume = db.query(Resume).filter(Resume.user_id == current_user.id).first()
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No resume found. Please upload a resume first."
        )

    for field, value in update_data.dict(exclude_unset=True).items():
        setattr(resume, field, value)

    db.commit()
    db.refresh(resume)

    return ResumeResponse.from_orm(resume)

@router.delete("/my-resume")
async def delete_resume(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete current user's resume"""
    resume = db.query(Resume).filter(Resume.user_id == current_user.id).first()
    
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No resume found"
        )
    
    # Delete file
    if os.path.exists(resume.file_path):
        os.remove(resume.file_path)
    
    db.delete(resume)
    db.commit()
    
    return {"message": "Resume deleted successfully"}
