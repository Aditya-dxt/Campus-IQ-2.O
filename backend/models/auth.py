from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str | None = Field(default=None, min_length=8, max_length=128)
    role: Literal["student", "mentor"]
    branch: str | None = Field(default=None, max_length=120)
    # Student: one-time ERP credentials (stored securely for refresh, never asked again)
    erp_id: str | None = Field(default=None, max_length=30, description="PSIT Roll No., e.g. 2401640100073")
    erp_password: str | None = Field(default=None, max_length=128)
    # Mentor: coordinator assignment
    coordinator_section: str | None = Field(default=None, max_length=80, description="Year-Section, e.g. CS-III-M or PSIT-CS-III-M")
    coordinator_year: str | None = Field(default=None, max_length=20)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: Literal["student", "mentor"]
    branch: str | None = None
    coordinator_section: str | None = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
