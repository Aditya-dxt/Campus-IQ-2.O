"""Predict API business logic — demo CSV fallback + Supabase integration."""

from __future__ import annotations

import hashlib
from functools import lru_cache

import pandas as pd

from config import STUDENTS_DATASET_PATH
from services.risk_predictor import FEATURE_NAMES, predict_risk
from services.supabase_client import get_supabase_client

DATASET_PATH = STUDENTS_DATASET_PATH

DEMO_NAMES = [
    ("Alex Chen", "Computer Science"),
    ("Jordan Lee", "Information Technology"),
    ("Samira Khan", "Computer Science"),
    ("Ravi Menon", "Electronics & CS"),
    ("Taylor Brooks", "Information Technology"),
    ("Morgan Ellis", "Computer Science"),
    ("Casey Ortiz", "Information Technology"),
    ("Jamie Wu", "Computer Science"),
]


@lru_cache
def _load_dataset() -> pd.DataFrame:
    if not DATASET_PATH.exists():
        raise FileNotFoundError(
            f"Training dataset not found at {DATASET_PATH}. "
            "Run ml/predictor/generate_synthetic_data.py first."
        )
    return pd.read_csv(DATASET_PATH)


def _stable_index(key: str, modulo: int) -> int:
    digest = hashlib.sha256(key.encode()).hexdigest()
    return int(digest[:8], 16) % modulo


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


def features_for_user(user_id: str) -> dict[str, float | int]:
    profile = _fetch_student_profile(user_id)
    if profile:
        return {name: profile[name] for name in FEATURE_NAMES}

    df = _load_dataset()
    row = df.iloc[_stable_index(user_id, len(df))]
    return {name: row[name] for name in FEATURE_NAMES}


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


def _student_record(user: dict) -> dict:
    user_id = user["id"]
    features = features_for_user(user_id)
    prediction = predict_risk(features)
    resume_score = _latest_resume_score(user_id)
    if resume_score is None:
        resume_score = int(round(40 + features["past_marks"] * 0.45))

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


def _demo_students(limit: int = 8) -> list[dict]:
    df = _load_dataset().head(limit)
    students = []
    for i, row in df.iterrows():
        name, branch = DEMO_NAMES[i % len(DEMO_NAMES)]
        features = {name_: row[name_] for name_ in FEATURE_NAMES}
        prediction = predict_risk(features)
        students.append(
            {
                "id": f"demo-{row['student_id']}",
                "name": name,
                "email": f"{name.split()[0].lower()}@campus.edu",
                "branch": branch,
                "academicRisk": prediction["academic_risk"],
                "placementReadiness": prediction["placement_readiness"],
                "topFactor": prediction["top_factor"],
                "resumeScore": int(round(40 + features["past_marks"] * 0.45)),
            }
        )
    return students


def _fetch_students_from_db() -> list[dict] | None:
    try:
        supabase = get_supabase_client()
        result = (
            supabase.table("users")
            .select("id, name, email, branch, role")
            .eq("role", "student")
            .execute()
        )
        if result.data:
            return [_student_record(u) for u in result.data]
    except Exception:
        pass
    return None


def list_students() -> list[dict]:
    db_students = _fetch_students_from_db()
    if db_students:
        return db_students
    return _demo_students()


def get_student(student_id: str) -> dict | None:
    db_students = _fetch_students_from_db()
    if db_students:
        for student in db_students:
            if student["id"] == student_id:
                return student
        return None

    for student in _demo_students():
        if student["id"] == student_id:
            return student
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
    user = _fetch_user(user_id) or {
        "id": user_id,
        "name": "Student",
        "email": "",
        "branch": None,
    }
    record = _student_record(user)
    return {
        "resumeScore": record["resumeScore"],
        "placementReadiness": record["placementReadiness"],
        "academicRisk": record["academicRisk"],
        "topFactor": record["topFactor"],
        "schedulePreview": [],
        "recentChat": None,
    }


def cohort_stats() -> dict:
    students = list_students()
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
