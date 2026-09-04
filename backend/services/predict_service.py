"""Predict API business logic — authentic Supabase-only data, no mock/demo fallbacks."""

from __future__ import annotations

from services.risk_predictor import FEATURE_NAMES, predict_risk
from services.supabase_client import get_supabase_client


def _fetch_student_profile(user_id: str) -> dict | None:
    try:
        supabase = get_supabase_client()
        result = (
            supabase.table("student_profiles")
            .select(", ".join(FEATURE_NAMES) + ", updated_at, year, section, erp_attendance, erp_marks")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]
    except Exception:
        # Fallback without year/section if migration not run
        try:
            supabase = get_supabase_client()
            result = (
                supabase.table("student_profiles")
                .select(", ".join(FEATURE_NAMES) + ", updated_at")
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


def _student_record(user: dict, profile: dict | None = None) -> dict | None:
    """Build a student record from real DB profile only. Returns None if no profile."""
    user_id = user["id"]
    if profile is None:
        profile = _fetch_student_profile(user_id)
    if not profile:
        return None
    features = {name: profile.get(name) for name in FEATURE_NAMES}
    # If any feature missing, prediction not possible but we still surface attendance/marks for mentor
    try:
        prediction = predict_risk(features) if all(v is not None for v in features.values()) else None
    except Exception:
        prediction = None
    resume_score = _latest_resume_score(user_id)
    section = profile.get("section")
    if not section and profile.get("erp_attendance"):
        try:
            section = profile["erp_attendance"].get("section")
        except Exception:
            pass
    return {
        "id": user_id,
        "name": user.get("name", "Student"),
        "email": user.get("email", ""),
        "branch": user.get("branch"),
        "section": section,
        "year": profile.get("year"),
        "attendancePct": float(profile["attendance_pct"]) if profile.get("attendance_pct") is not None else None,
        "pastMarks": float(profile["past_marks"]) if profile.get("past_marks") is not None else None,
        "academicRisk": prediction["academic_risk"] if prediction else None,
        "placementReadiness": prediction["placement_readiness"] if prediction else None,
        "topFactor": prediction["top_factor"] if prediction else None,
        "resumeScore": resume_score,
    }


def _fetch_students_from_db(mentor_section: str | None = None) -> list[dict]:
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
            if rec is None:
                continue
            if mentor_section:
                # Strict isolation: mentor sees only same year-section
                ms = mentor_section.strip().upper()
                ss = (rec.get("section") or "").strip().upper()
                # Allow substring match: CS-III-M matches PSIT-CS-III-M
                if not ss or ms not in ss and ss not in ms:
                    # Also try year match fallback
                    if rec.get("year") and ms and rec["year"].upper() not in ms:
                        continue
                    elif not rec.get("year"):
                        continue
                    # if above didn't match, skip
                    if ms not in ss and ss not in ms:
                        continue
            records.append(rec)
        return records
    except Exception:
        return []


def list_students(mentor_section: str | None = None) -> list[dict]:
    """Return only authentic students who have a student_profiles row. Filtered by mentor section if given."""
    return _fetch_students_from_db(mentor_section)


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
    profile = _fetch_student_profile(user_id)
    if profile:
        has_real_features = all(profile.get(name) is not None for name in FEATURE_NAMES)
        if has_real_features:
            features = {name: profile[name] for name in FEATURE_NAMES}
            try:
                prediction = predict_risk(features)
            except Exception:
                prediction = None
            if prediction:
                resume_score = _latest_resume_score(user_id)
                return {
                    "resumeScore": resume_score,
                    "placementReadiness": prediction["placement_readiness"],
                    "academicRisk": prediction["academic_risk"],
                    "topFactor": prediction["top_factor"],
                    "hasData": True,
                    "attendancePct": float(profile.get("attendance_pct")) if profile.get("attendance_pct") is not None else None,
                    "pastMarks": float(profile.get("past_marks")) if profile.get("past_marks") is not None else None,
                    "attendanceUpdatedAt": profile.get("updated_at"),
                    "year": profile.get("year"),
                    "section": profile.get("section") or (profile.get("erp_attendance") or {}).get("section"),
                    "schedulePreview": [],
                    "recentChat": None,
                }
        resume_score = _latest_resume_score(user_id)
        return {
            "resumeScore": resume_score,
            "placementReadiness": None,
            "academicRisk": None,
            "topFactor": None,
            "hasData": False,
            "attendancePct": float(profile.get("attendance_pct")) if profile.get("attendance_pct") is not None else None,
            "pastMarks": float(profile.get("past_marks")) if profile.get("past_marks") is not None else None,
            "attendanceUpdatedAt": profile.get("updated_at"),
            "year": profile.get("year"),
            "section": profile.get("section") or (profile.get("erp_attendance") or {}).get("section"),
            "schedulePreview": [],
            "recentChat": None,
        }
    resume_score = _latest_resume_score(user_id)
    return {
        "resumeScore": resume_score,
        "placementReadiness": None,
        "academicRisk": None,
        "topFactor": None,
        "hasData": False,
        "attendancePct": None,
        "pastMarks": None,
        "attendanceUpdatedAt": None,
        "year": None,
        "section": None,
        "schedulePreview": [],
        "recentChat": None,
    }


def cohort_stats(mentor_section: str | None = None) -> dict:
    students = list_students(mentor_section)
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
    low = sum(1 for s in students if s.get("academicRisk") is not None and s["academicRisk"] < 0.35)
    mid = sum(1 for s in students if s.get("academicRisk") is not None and 0.35 <= s["academicRisk"] < 0.65)
    high = sum(1 for s in students if s.get("academicRisk") is not None and s["academicRisk"] >= 0.65)
    flagged = high
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
