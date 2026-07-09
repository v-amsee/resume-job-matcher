from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
import jwt
from datetime import datetime, timedelta
from passlib.context import CryptContext
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
import os
import secrets
import smtplib
from email.mime.text import MIMEText

from database import get_db
from models import User, UserType, PasswordResetToken

router = APIRouter()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT config
SECRET_KEY = os.getenv("JWT_SECRET", "your-secret-key-change-this")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", 24))

# only need the client ID server-side -- we're just verifying an ID token
# Google already signed, not doing an auth-code exchange, so no secret needed
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

# SMTP config for forgot-password emails, all optional. If unset, _send_email
# just logs instead of sending (forgot-password always returns 200 either way)
SMTP_SERVER = os.getenv("SMTP_SERVER")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
RESET_TOKEN_TTL_HOURS = 1

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)

# Pydantic schemas
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)  # matches the frontend check, but enforced here too
    name: str
    user_type: UserType = UserType.JOB_SEEKER
    company: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GoogleAuthRequest(BaseModel):
    credential: str  # the signed ID token Google's Sign In button returns

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    user_type: UserType
    company: Optional[str] = None

    class Config:
        from_attributes = True

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# Helper functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def _send_email(to_email: str, subject: str, body: str) -> bool:
    """Best-effort send -- logs and returns False instead of raising if SMTP
    isn't configured or the send fails, so a broken mail setup never 500s."""
    if not SMTP_SERVER or not SMTP_USER or not SMTP_PASSWORD:
        print(f"[email] SMTP not configured -- would have sent to {to_email}: {subject}\n{body}")
        return False
    try:
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = SMTP_USER
        msg["To"] = to_email
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, [to_email], msg.as_string())
        return True
    except Exception as e:
        print(f"[email] Failed to send to {to_email}: {e}")
        return False

def create_access_token(user_id: int) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(hours=EXPIRATION_HOURS)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Pulls the user off the Authorization: Bearer token."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_token(token)
    user_id = payload.get("user_id")

    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user

def get_optional_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Optional[User]:
    """Same as get_current_user but returns None instead of raising --
    for endpoints anyone can hit, that just add extra fields when logged in."""
    if not token:
        return None
    try:
        payload = verify_token(token)
    except HTTPException:
        return None
    user_id = payload.get("user_id")
    if not user_id:
        return None
    return db.query(User).filter(User.id == user_id).first()

# Routes
@router.post("/register", response_model=Token)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Register a new user"""
    # Check if user exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user
    db_user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        name=user_data.name,
        user_type=user_data.user_type,
        company=user_data.company
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Generate token
    token = create_access_token(db_user.id)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse.from_orm(db_user)
    }

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Login user"""
    user = db.query(User).filter(User.email == credentials.email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Google-only accounts have no password_hash -- point them the right way
    # instead of a confusing "invalid password" for a password that was never set
    if not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account uses Google sign-in. Continue with Google instead."
        )

    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Generate token
    token = create_access_token(user.id)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse.from_orm(user)
    }

@router.post("/google", response_model=Token)
async def google_login(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Verify the Google ID token and log the user in, creating an account
    on first sign-in. Reuses an existing password account with the same
    email if there is one, rather than erroring or duplicating it."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in isn't configured on this server."
        )

    try:
        idinfo = google_id_token.verify_oauth2_token(
            payload.credential, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    email = idinfo.get("email")
    if not email or not idinfo.get("email_verified"):
        raise HTTPException(status_code=400, detail="Google account has no verified email")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            password_hash=None,
            name=idinfo.get("name") or email.split("@")[0],
            user_type=UserType.JOB_SEEKER,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token(user.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse.from_orm(user)
    }

@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Always returns the same message whether or not the email exists --
    don't want this endpoint usable to check which emails have accounts."""
    user = db.query(User).filter(User.email == payload.email).first()

    if user:
        if not user.password_hash:
            # nothing to reset on a Google-only account, so just tell them that
            _send_email(
                user.email,
                "Sign in with Google instead",
                "This account was created with Google Sign-In and doesn't have a password to reset.\n"
                "Use the 'Sign in with Google' button on the login page instead.",
            )
        else:
            token = secrets.token_urlsafe(32)
            db.add(PasswordResetToken(
                user_id=user.id,
                token=token,
                expires_at=datetime.utcnow() + timedelta(hours=RESET_TOKEN_TTL_HOURS),
            ))
            db.commit()

            reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
            _send_email(
                user.email,
                "Reset your password",
                "Click the link below to set a new password. "
                f"This link expires in {RESET_TOKEN_TTL_HOURS} hour(s).\n\n{reset_link}\n\n"
                "If you didn't request this, you can safely ignore this email.",
            )

    return {"message": "If that email is registered, a reset link has been sent."}

@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    reset = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == payload.token,
        PasswordResetToken.used == False,
    ).first()

    if not reset or reset.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired.")

    user = db.query(User).filter(User.id == reset.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(payload.new_password)
    reset.used = True
    db.commit()

    return {"message": "Password updated. You can now log in."}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return UserResponse.from_orm(current_user)

@router.put("/profile", response_model=UserResponse)
async def update_profile(
    profile_data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user profile"""
    if profile_data.name:
        current_user.name = profile_data.name
    if profile_data.company and current_user.user_type == UserType.EMPLOYER:
        current_user.company = profile_data.company

    db.commit()
    db.refresh(current_user)
    
    return UserResponse.from_orm(current_user)

@router.post("/logout")
async def logout():
    """Logout user (frontend should delete token)"""
    return {"message": "Logged out successfully"}
