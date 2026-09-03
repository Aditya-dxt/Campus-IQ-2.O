"""Predict API business logic — authentic Supabase-only data, no mock/demo fallbacks."""

from __future__ import annotations

from services.risk_predictor import FEATURE_NAMES, predict_risk
from services.supabase_client import get_supabase_client


def _fetch_student_profile(user_id: str) -> dict | None:
    try:
        supabase = get_supabase_client()
        result = (
            supabase.table("student_profiles")
            .select(", ".join(FEATURE_NAMES))
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]
    except Exception:
        pass
    return None


def _latest_resume_score(user_id: str) -> int | None:
    try:
        supabase = get_supabase_client()
        result = (
            supabase.table("resumes")
            .select("score")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            return int(float(result.data[0]["score"]))
    except Exception:
        pass
    return None


def _student_record(user: dict) -> dict | None:
    """Build a student record from real DB profile only. Returns None if no profile."""
    user_id = user["id"]
    profile = _fetch_student_profile(user_id)
    if not profile:
        # No authentic profile — do not fabricate data, return null so caller can skip
        return None
    features = {name: profile[name] for name in FEATURE_NAMES}
    try:
        prediction = predict_risk(features)
    except Exception:
        return None
    resume_score = _latest_resume_score(user_id)
    return {
        "id": user_id,
        "name": user.get("name", "Student"),
        "email": user.get("email", ""),
        "branch": user.get("branch"),
        "academicRisk": prediction["academic_risk"],
        "placementReadiness": prediction["placement_readiness"],
        "topFactor": prediction["top_factor"],
        "resumeScore": resume_score,
    }


def _fetch_students_from_db() -> list[dict]:
    try:
        supabase = get_supabase_client()
        result = (
            supabase.table("users")
            .select("id, name, email, branch, role")
            .eq("role", "student")
            .execute()
        )
        if not result.data:
            return []
        records: list[dict] = []
        for u in result.data:
            rec = _student_record(u)
            if rec is not None:
                records.append(rec)
        return records
    except Exception:
        return []


def list_students() -> list[dict]:
    """Return only authentic students who have a student_profiles row. No demo fallback."""
    return _fetch_students_from_db()


def get_student(student_id: str) -> dict | None:
    students = _fetch_students_from_db()
    for s in students:
        if s["id"] == student_id:
            return s
    return None


def _fetch_user(user_id: str) -> dict | None:
    try:
        supabase = get_supabase_client()
        result = (
            supabase.table("users")
            .select("id, name, email, branch, role")
            .eq("id", user_id)
            .single()
            .execute()
        )
        return result.data
    except Exception:
        return None


def student_dashboard(user_id: str) -> dict:
    # Try to get real student profile data from the DB
    profile = _fetch_student_profile(user_id)
    if profile:
        features = {name: profile[name] for name in FEATURE_NAMES}
        prediction = predict_risk(features)
        resume_score = _latest_resume_score(user_id)
        return {
            "resumeScore": resume_score,
            "placementReadiness": prediction["placement_readiness"],
            "academicRisk": prediction["academic_risk"],
            "topFactor": prediction["top_factor"],
            "hasData": True,
            "attendancePct": float(profile.get("attendance_pct")) if profile.get("attendance_pct") is not None else None,
            "attendanceUpdatedAt": profile.get("updated_at"),
            "schedulePreview": [],
            "recentChat": None,
        }
    # No real data — authentic empty state
    resume_score = _latest_resume_score(user_id)
    return {
        "resumeScore": resume_score,
        "placementReadiness": None,
        "academicRisk": None,
        "topFactor": None,
        "hasData": False,
        "attendancePct": None,
        "attendanceUpdatedAt": None,
        "schedulePreview": [],
        "recentChat": None,
    }


def cohort_stats() -> dict:
    students = list_students()
    if not students:
        return {
            "studentsOverseen": 0,
            "currentlyFlagged": 0,
            "interventionsThisMonth": 0,
            "riskDistribution": [
                {"bucket": "Low", "count": 0, "fill": "#5a8f7b"},
                {"bucket": "Moderate", "count": 0, "fill": "#c4923a"},
                {"bucket": "Elevated", "count": 0, "fill": "#b85c5c"},
            ],
        }
    low = sum(1 for s in students if s["academicRisk"] < 0.35)
    mid = sum(1 for s in students if 0.35 <= s["academicRisk"] < 0.65)
    high = sum(1 for s in students if s["academicRisk"] >= 0.65)
    flagged = sum(1 for s in students if s["academicRisk"] >= 0.65)
    return {
        "studentsOverseen": len(students),
        "currentlyFlagged": flagged,
        "interventionsThisMonth": 0,
        "riskDistribution": [
            {"bucket": "Low", "count": low, "fill": "#5a8f7b"},
            {"bucket": "Moderate", "count": mid, "fill": "#c4923a"},
            {"bucket": "Elevated", "count": high, "fill": "#b85c5c"},
        ],
    }
