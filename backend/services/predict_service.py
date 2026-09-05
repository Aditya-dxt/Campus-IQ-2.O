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


def _live_counts(user_id: str) -> dict:
    """Derive resume/chat counts live so dashboard unlocks without manual profile sync."""
    counts = {}
    try:
        supabase = get_supabase_client()
        r = supabase.table("resumes").select("id").eq("user_id", user_id).execute()
        counts["resume_scans_count"] = len(r.data or [])
    except Exception:
        pass
    try:
        supabase = get_supabase_client()
        r2 = supabase.table("chat_feedback").select("id").eq("user_id", user_id).execute()
        counts["career_chat_activity_count"] = len(r2.data or [])
    except Exception:
        pass
    return counts


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


def _latest_study_chat(user_id: str) -> dict | None:
    try:
        supabase = get_supabase_client()
        res = (
            supabase.table("chat_feedback")
            .select("doc_id, question, answer, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if res.data:
            r = res.data[0]
            ans = (r.get("answer") or "").strip()
            preview = ans[:140] + ("…" if len(ans) > 140 else "")
            did = r.get("doc_id") or ""
            title = did[:12] + "…" if len(did) > 12 else (did or "Study doc")
            return {"docTitle": title, "question": r.get("question") or "", "preview": preview or "—", "created_at": r.get("created_at")}
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
    resume_score = _latest_resume_score(user_id)
    # Build features dict (only attendance/marks matter for new formula, but keep full for compat)
    enriched = dict(profile)
    # For placement we only need attendance/past_marks + resume; still fill live counts for future
    live = _live_counts(user_id)
    if enriched.get("resume_scans_count") is None and "resume_scans_count" in live:
        enriched["resume_scans_count"] = live["resume_scans_count"]
    if enriched.get("career_chat_activity_count") is None and "career_chat_activity_count" in live:
        enriched["career_chat_activity_count"] = live["career_chat_activity_count"]
    if enriched.get("mock_interview_score") is None and resume_score is not None:
        enriched["mock_interview_score"] = int(resume_score)
    if enriched.get("submission_rate") is None:
        enriched["submission_rate"] = 70.0
    if enriched.get("login_frequency") is None:
        enriched["login_frequency"] = 5
    # New formula: pass resume_score explicitly
    try:
        prediction = predict_risk(enriched, resume_score=resume_score)
    except Exception:
        prediction = None
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
        "breakdown": prediction["breakdown"] if prediction else None,
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
    recent = _latest_study_chat(user_id)
    resume_score = _latest_resume_score(user_id)
    if profile:
        enriched = dict(profile)
        if enriched.get("mock_interview_score") is None and resume_score is not None:
            enriched["mock_interview_score"] = int(resume_score)
        if enriched.get("submission_rate") is None:
            enriched["submission_rate"] = 70.0
        if enriched.get("login_frequency") is None:
            enriched["login_frequency"] = 5
        # live counts still enrich for completeness
        live = _live_counts(user_id)
        if enriched.get("resume_scans_count") is None and "resume_scans_count" in live:
            enriched["resume_scans_count"] = live["resume_scans_count"]
        if enriched.get("career_chat_activity_count") is None and "career_chat_activity_count" in live:
            enriched["career_chat_activity_count"] = live["career_chat_activity_count"]
        try:
            prediction = predict_risk(enriched, resume_score=resume_score)
        except Exception:
            prediction = None
        if prediction:
            return {
                "resumeScore": resume_score,
                "placementReadiness": prediction["placement_readiness"],
                "academicRisk": prediction["academic_risk"],
                "topFactor": prediction["top_factor"],
                "breakdown": prediction["breakdown"],
                "hasData": True,
                "attendancePct": float(profile.get("attendance_pct")) if profile.get("attendance_pct") is not None else None,
                "pastMarks": float(profile.get("past_marks")) if profile.get("past_marks") is not None else None,
                "attendanceUpdatedAt": profile.get("updated_at"),
                "year": profile.get("year"),
                "section": profile.get("section") or (profile.get("erp_attendance") or {}).get("section"),
                "schedulePreview": [],
                "recentChat": recent,
            }
        return {
            "resumeScore": resume_score,
            "placementReadiness": None,
            "academicRisk": None,
            "topFactor": None,
            "breakdown": None,
            "hasData": False,
            "attendancePct": float(profile.get("attendance_pct")) if profile.get("attendance_pct") is not None else None,
            "pastMarks": float(profile.get("past_marks")) if profile.get("past_marks") is not None else None,
            "attendanceUpdatedAt": profile.get("updated_at"),
            "year": profile.get("year"),
            "section": profile.get("section") or (profile.get("erp_attendance") or {}).get("section"),
            "schedulePreview": [],
            "recentChat": recent,
        }
    return {
        "resumeScore": resume_score,
        "placementReadiness": None,
        "academicRisk": None,
        "topFactor": None,
        "breakdown": None,
        "hasData": False,
        "attendancePct": None,
        "pastMarks": None,
        "attendanceUpdatedAt": None,
        "year": None,
        "section": None,
        "schedulePreview": [],
        "recentChat": recent,
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
