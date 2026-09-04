import base64
import re

from fastapi import APIRouter, HTTPException, status

from dependencies import CurrentUser
from models.auth import AuthResponse, LoginRequest, SignupRequest, UserResponse
from services.jwt_service import create_access_token
from services.supabase_client import get_supabase_client

router = APIRouter(prefix="/auth", tags=["auth"])


def _enc(pw: str) -> str:
    return base64.b64encode(pw.encode()).decode()

def _parse_year_section(section_str: str | None) -> tuple[str | None, str | None]:
    if not section_str:
        return None, None
    s = section_str.strip().upper()
    # e.g. PSIT-CS-III-M or CS-III-M → year III, section M
    parts = s.split("-")
    if len(parts) >= 2:
        # last token is section letter, second-last is roman year
        section = parts[-1].strip() or None
        year = parts[-2].strip() if len(parts) >= 3 else None
        return year, section
    return None, s

def _build_user_response(profile: dict) -> UserResponse:
    return UserResponse(
        id=profile["id"],
        name=profile["name"],
        email=profile["email"],
        role=profile["role"],
        branch=profile.get("branch"),
        coordinator_section=profile.get("coordinator_section"),
    )


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest) -> AuthResponse:
    if body.confirm_password and body.password != body.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match.")

    # Role-specific validation
    if body.role == "student":
        if not body.erp_id or not body.erp_password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student requires ERP Roll No. and ERP Password (one-time).")
        if not re.match(r"^\d{10,15}$", body.erp_id.strip()):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ERP Roll No. — expected 10-15 digits.")
    if body.role == "mentor":
        if not body.coordinator_section or not body.coordinator_section.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mentor requires coordinator Year-Section (e.g. CS-III-M).")

    supabase = get_supabase_client()

    try:
        auth_response = supabase.auth.sign_up(
            {
                "email": body.email,
                "password": body.password,
                "options": {
                    "data": {
                        "name": body.name,
                        "role": body.role,
                        "branch": body.branch,
                    }
                },
            }
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Signup failed: {exc}",
        ) from exc

    if not auth_response.user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Signup failed: no user returned from Supabase",
        )

    user_id = auth_response.user.id
    profile = {
        "id": user_id,
        "name": body.name,
        "email": body.email,
        "role": body.role,
        "branch": body.branch,
    }
    if body.role == "mentor" and body.coordinator_section:
        cs = body.coordinator_section.strip().upper()
        cy, _ = _parse_year_section(cs)
        profile["coordinator_section"] = cs
        if cy:
            profile["coordinator_year"] = cy

    try:
        supabase.table("users").insert(profile).execute()
    except Exception as exc:
        # If duplicate coordinator column missing, retry without it
        if "coordinator" in str(exc).lower():
            try:
                fallback = {k: v for k, v in profile.items() if k not in ("coordinator_section", "coordinator_year")}
                # store in branch as fallback
                if body.role == "mentor" and body.coordinator_section:
                    fallback["branch"] = body.coordinator_section.strip().upper()
                supabase.table("users").insert(fallback).execute()
            except Exception as exc2:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to create user profile: {exc2}") from exc2
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to create user profile: {exc}") from exc

    # Student: one-time ERP scrape on signup → fill Year/Section/Attendance/Marks, store creds for refresh
    if body.role == "student":
        try:
            supabase.table("student_profiles").insert(
                {
                    "user_id": user_id,
                    "attendance_pct": None,
                    "past_marks": None,
                    "submission_rate": None,
                    "login_frequency": None,
                    "resume_scans_count": None,
                    "mock_interview_score": None,
                    "career_chat_activity_count": None,
                }
            ).execute()
        except Exception:
            pass
        # Scrape ERP synchronously — credentials stored so user never re-enters after logout
        try:
            from services.erp_psit import scrape_psit_erp

            data = scrape_psit_erp(body.erp_id.strip(), body.erp_password)  # type: ignore
            enc = _enc(body.erp_password)  # type: ignore
            att = float(data["attendance_pct"]) if data.get("attendance_pct") is not None else None
            avg = data.get("avg_marks_percent")
            section_raw = data.get("section")  # e.g. PSIT-CS-III-M
            year, sec_letter = _parse_year_section(section_raw)
            # Save creds
            try:
                supabase.table("erp_credentials").upsert(
                    {
                        "user_id": user_id,
                        "erp_id": body.erp_id.strip(),  # type: ignore
                        "erp_password": enc,
                        "last_synced_at": data.get("scraped_at"),
                        "last_attendance_pct": att,
                        "last_marks_avg": float(avg) if avg is not None else None,
                    },
                    on_conflict="user_id",
                ).execute()
            except Exception:
                pass
            # Update profile with real ERP snapshot — strict per-user, no sharing
            payload: dict = {
                "user_id": user_id,
                "attendance_pct": att,
                "erp_id": body.erp_id.strip(),  # type: ignore
                "erp_password": enc,
                "erp_last_synced": data.get("scraped_at"),
                "erp_attendance": {
                    "attendance_pct": att,
                    "with_pf_pct": data.get("with_pf_pct"),
                    "without_pf_pct": data.get("without_pf_pct"),
                    "tl": data.get("tl"),
                    "present": data.get("present"),
                    "pf": data.get("pf"),
                    "absent": data.get("absent"),
                    "section": section_raw,
                },
                "erp_marks": data.get("marks", []),
                "section": section_raw,
                "year": year,
            }
            if avg is not None:
                payload["past_marks"] = float(avg)
            try:
                supabase.table("student_profiles").upsert(payload, on_conflict="user_id").execute()
            except Exception:
                # Columns may not exist yet → fallback to core fields
                try:
                    supabase.table("student_profiles").upsert(
                        {"user_id": user_id, "attendance_pct": att, **({"past_marks": float(avg)} if avg is not None else {})},
                        on_conflict="user_id",
                    ).execute()
                except Exception:
                    pass
        except Exception as exc:
            # Signup still succeeds — store creds so Refresh can retry, surface warning in logs
            try:
                supabase.table("erp_credentials").upsert(
                    {"user_id": user_id, "erp_id": body.erp_id.strip(), "erp_password": _enc(body.erp_password)},  # type: ignore
                    on_conflict="user_id",
                ).execute()
            except Exception:
                pass
            try:
                supabase.table("student_profiles").upsert(
                    {"user_id": user_id, "erp_id": body.erp_id.strip(), "erp_password": _enc(body.erp_password)},  # type: ignore
                    on_conflict="user_id",
                ).execute()
            except Exception:
                pass
            print(f"[signup] ERP scrape failed for {body.erp_id}: {exc}")

    token = create_access_token(
        user_id=user_id,
        email=body.email,
        role=body.role,
    )
    return AuthResponse(
        access_token=token,
        user=_build_user_response(profile),
    )


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest) -> AuthResponse:
    supabase = get_supabase_client()

    try:
        auth_response = supabase.auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        ) from exc

    if not auth_response.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user_id = auth_response.user.id

    try:
        profile_response = (
            supabase.table("users")
            .select("id, name, email, role, branch, coordinator_section")
            .eq("id", user_id)
            .single()
            .execute()
        )
    except Exception:
        # Fallback without coordinator column if migration not run
        try:
            profile_response = (
                supabase.table("users").select("id, name, email, role, branch").eq("id", user_id).single().execute()
            )
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found") from exc

    profile = profile_response.data
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found",
        )

    token = create_access_token(
        user_id=user_id,
        email=profile["email"],
        role=profile["role"],
    )
    return AuthResponse(
        access_token=token,
        user=_build_user_response(profile),
    )


@router.get("/me")
def get_me(current_user: CurrentUser) -> dict:
    return {
        "id": current_user["sub"],
        "email": current_user["email"],
        "role": current_user["role"],
    }
