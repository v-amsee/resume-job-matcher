from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, Boolean, ARRAY, Enum, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

Base = declarative_base()

class UserType(str, enum.Enum):
    JOB_SEEKER = "job_seeker"
    EMPLOYER = "employer"

class ApplicationStatus(str, enum.Enum):
    APPLIED = "applied"
    REJECTED = "rejected"
    INTERVIEW_SCHEDULED = "interview_scheduled"
    ACCEPTED = "accepted"

class JobSource(str, enum.Enum):
    """Where a job posting came from. INTERNAL = posted through our own
    form, everything else came from a sync job hitting that source's API."""
    INTERNAL = "internal"
    REMOTIVE = "remotive"
    REMOTEOK = "remoteok"
    ARBEITNOW = "arbeitnow"
    WEWORKREMOTELY = "weworkremotely"
    WORKINGNOMADS = "workingnomads"
    GREENHOUSE = "greenhouse"
    LEVER = "lever"
    ASHBY = "ashby"
    ADZUNA = "adzuna"
    REED = "reed"
    JOOBLE = "jooble"

class SponsorshipStatus(str, enum.Enum):
    """Heuristic read on whether a posting mentions visa sponsorship (see
    job_enrichment.py). NOT_MENTIONED is by far the most common case."""
    SPONSORS = "sponsors"
    MAY_SPONSOR = "may_sponsor"
    UNLIKELY = "unlikely"
    NOT_MENTIONED = "not_mentioned"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    name = Column(String)
    user_type = Column(Enum(UserType), default=UserType.JOB_SEEKER)
    company = Column(String, nullable=True)  # For employers
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    resumes = relationship("Resume", back_populates="user")
    jobs = relationship("Job", back_populates="employer")
    applications = relationship("Application", back_populates="user")
    saved_jobs = relationship("SavedJob", back_populates="user")

class Resume(Base):
    __tablename__ = "resumes"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    file_path = Column(String)
    file_name = Column(String)
    
    # Extracted data
    # default=list, not default=[] -- a literal list gets reused across every
    # row, default=list is called fresh per insert
    skills = Column(ARRAY(String), default=list)
    experience_years = Column(Integer, nullable=True)
    education = Column(String, nullable=True)
    job_titles = Column(ARRAY(String), default=list)
    summary = Column(Text, nullable=True)
    languages = Column(ARRAY(String), default=list)
    certifications = Column(ARRAY(String), default=list)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="resumes")

class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    # nullable -- only internally-posted jobs have an employer account attached
    employer_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    title = Column(String, index=True)
    company = Column(String, index=True)
    description = Column(Text)

    # Skills
    required_skills = Column(ARRAY(String), default=list)
    nice_to_have_skills = Column(ARRAY(String), default=list)

    # Job details
    salary_min = Column(Float, nullable=True)
    salary_max = Column(Float, nullable=True)
    location = Column(String, index=True)
    job_type = Column(String, default="Full-time")  # Full-time, Part-time, Contract
    experience_level = Column(String, default="mid")  # junior, mid, senior

    # External sourcing
    source = Column(Enum(JobSource), default=JobSource.INTERNAL, index=True)
    external_id = Column(String, nullable=True, index=True)  # the source's own job id, used to dedupe on resync
    apply_url = Column(String, nullable=True)  # null for internal jobs, handled in-app instead
    sponsorship = Column(Enum(SponsorshipStatus), default=SponsorshipStatus.NOT_MENTIONED)

    posted_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    __table_args__ = (
        # stops resync from duplicating jobs we've already imported. Internal
        # jobs are all external_id=NULL, and NULLs never collide in SQL, so
        # this doesn't get in the way of multiple internal postings
        UniqueConstraint('source', 'external_id', name='uq_job_source_external_id'),
    )

    # Relationships
    employer = relationship("User", back_populates="jobs")
    applications = relationship("Application", back_populates="job")
    saved_jobs = relationship("SavedJob", back_populates="job")

class Application(Base):
    __tablename__ = "applications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), index=True)
    
    status = Column(Enum(ApplicationStatus), default=ApplicationStatus.APPLIED, index=True)
    match_score = Column(Float, nullable=True)  # 0-100
    matched_skills = Column(ARRAY(String), default=list)
    missing_skills = Column(ARRAY(String), default=list)
    
    interview_date = Column(DateTime, nullable=True)
    interview_link = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    
    applied_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="applications")
    job = relationship("Job", back_populates="applications")

class PasswordResetToken(Base):
    """One-time-use token emailed on a password reset request. Its own
    table rather than columns on User, since create_all() will happily add a
    new table but won't alter an existing one."""
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    token = Column(String, unique=True, index=True)
    expires_at = Column(DateTime)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")

class SavedJob(Base):
    __tablename__ = "saved_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), index=True)
    
    saved_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    user = relationship("User", back_populates="saved_jobs")
    job = relationship("Job", back_populates="saved_jobs")
