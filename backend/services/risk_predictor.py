"""Lazy-loaded risk model with graceful fallback when artifact is missing.

Provides:
- predict_risk(features) -> {academic_risk, placement_readiness, top_factor, at_risk, breakdown}
- record_intervention_risk_before(intervention_id, features) -> snapshot
- compute_intervention_risk_after(intervention_id, features) -> delta report

PLACEMENT FORMULA (user requirement):
  placement_readiness is based ONLY on marks + attendance + resume.
  Weights: marks 40%, attendance 30%, resume 30%.
  If no resume -> 50% marks + 50% attendance (re-normalised).

RISK FORMULA (user requirement):
  academic_risk = 1 - placement_readiness  (risk is inverse of placement)
  Both are 0-1, rounded to 4 decimals.
"""

from __future__ import annotations

from datetime import date
from typing import Any

import numpy as np
import pandas as pd

from config import RISK_MODEL_PATH

MODEL_PATH = RISK_MODEL_PATH

FEATURE_NAMES = [
    "attendance_pct",
    "past_marks",
    "submission_rate",
    "login_frequency",
    "resume_scans_count",
    "mock_interview_score",
    "career_chat_activity_count",
]

FEATURE_LABELS = {
    "attendance_pct": "Low attendance",
    "past_marks": "Low past marks",
    "submission_rate": "Low assignment submission rate",
    "login_frequency": "Low platform login frequency",
    "resume_scans_count": "Few resume scans",
    "mock_interview_score": "Low mock interview score",
    "career_chat_activity_count": "Low career chat activity",
}

# ── Module-level singleton: loaded once, reused on every call ────────
_ARTIFACT: dict[str, Any] | None = None


def model_available() -> bool:
    return MODEL_PATH.exists()


def _load_artifact() -> dict[str, Any]:
    global _ARTIFACT
    if _ARTIFACT is not None:
        return _ARTIFACT
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Risk model not found at {MODEL_PATH}. Run ml/predictor/train.py first.")
    import joblib
    _ARTIFACT = joblib.load(MODEL_PATH)
    return _ARTIFACT


def _classifier():
    return _load_artifact()["classifier"]


def _threshold() -> float:
    return float(_load_artifact().get("threshold", 0.5))


def _model_name() -> str:
    artifact = _load_artifact()
    return artifact.get("model_name", type(artifact["classifier"]).__name__)


def _feature_contributions(features_df: pd.DataFrame) -> np.ndarray:
    classifier = _classifier()
    cls_name = type(classifier).__name__
    if cls_name == "XGBClassifier":
        import xgboost as xgb
        dmatrix = xgb.DMatrix(features_df)
        contribs = classifier.get_booster().predict(dmatrix, pred_contribs=True)
        return np.asarray(contribs)[0][:-1]
    import shap
    explainer = shap.TreeExplainer(classifier)
    shap_values = explainer.shap_values(features_df)
    if isinstance(shap_values, list):
        shap_values = shap_values[1]
    return np.asarray(shap_values)[0]


def _features_frame(features: dict[str, float | int]) -> pd.DataFrame:
    row = {name: float(features[name]) for name in FEATURE_NAMES}
    return pd.DataFrame([row])


# ── Placement + Risk (new user formula) ───────────────────────────────

def _compute_placement_readiness_new(
    features: dict[str, float | int],
    resume_score: int | None = None,
) -> tuple[float, dict]:
    """
    Placement = 0.40*marks + 0.30*attendance + 0.30*resume
    Resume is latest resume score /100. If no resume -> 0.5*marks + 0.5*attendance.
    Returns (placement 0-1, breakdown dict for UI).
    """
    marks_norm = float(features.get("past_marks", 0)) / 100.0
    att_norm = float(features.get("attendance_pct", 0)) / 100.0

    # resume: prefer explicit resume_score, else mock_interview_score, else scans
    if resume_score is not None:
        resume_norm = float(resume_score) / 100.0
        has_resume = True
    else:
        mock = features.get("mock_interview_score")
        if mock is not None and float(mock) > 0:
            resume_norm = float(mock) / 100.0
            has_resume = True
        else:
            # no resume at all
            resume_norm = 0.0
            has_resume = False

    if has_resume:
        placement = 0.40 * marks_norm + 0.30 * att_norm + 0.30 * resume_norm
        weights = {"marks": 0.40, "attendance": 0.30, "resume": 0.30}
        contrib = {
            "marks": round(0.40 * marks_norm, 4),
            "attendance": round(0.30 * att_norm, 4),
            "resume": round(0.30 * resume_norm, 4),
        }
    else:
        placement = 0.50 * marks_norm + 0.50 * att_norm
        weights = {"marks": 0.50, "attendance": 0.50, "resume": 0.0}
        contrib = {
            "marks": round(0.50 * marks_norm, 4),
            "attendance": round(0.50 * att_norm, 4),
            "resume": 0.0,
        }

    placement = round(float(np.clip(placement, 0.0, 1.0)), 4)
    breakdown = {
        "marks_pct": round(marks_norm * 100, 1),
        "attendance_pct": round(att_norm * 100, 1),
        "resume_score": resume_score if has_resume else None,
        "resume_pct": round(resume_norm * 100, 1) if has_resume else None,
        "has_resume": has_resume,
        "weights": weights,
        "contributions": contrib,
        "formula": "0.40*marks + 0.30*attendance + 0.30*resume" if has_resume else "0.50*marks + 0.50*attendance (no resume yet)",
    }
    return placement, breakdown


def _compute_top_factor_from_breakdown(breakdown: dict) -> str:
    """Weakest link drives risk: smallest normalized component."""
    candidates = []
    if breakdown["marks_pct"] is not None:
        candidates.append(("Low past marks", breakdown["marks_pct"]))
    if breakdown["attendance_pct"] is not None:
        candidates.append(("Low attendance", breakdown["attendance_pct"]))
    if breakdown["has_resume"]:
        candidates.append(("Low resume score", breakdown["resume_pct"]))
    if not candidates:
        return "Insufficient data"
    # lowest pct = biggest drag on placement -> top factor
    candidates.sort(key=lambda x: x[1])
    return candidates[0][0]


# ── Main prediction API ─────────────────────────────────────────────

def predict_risk(features: dict[str, float | int], resume_score: int | None = None) -> dict:
    """
    New logic: placement from marks+attendance+resume, risk = 1 - placement.
    Still accepts full FEATURE_NAMES dict (ignored extras) for backward compat.
    Optional resume_score overrides mock_interview_score.
    Returns breakdown for mentor UI.
    """
    # Resolve resume_score: explicit > mock_interview_score > None
    if resume_score is None:
        mock = features.get("mock_interview_score")
        if mock is not None and float(mock) > 0:
            try:
                resume_score = int(float(mock))  # type: ignore[arg-type]
            except Exception:
                resume_score = None

    placement, breakdown = _compute_placement_readiness_new(features, resume_score)
    academic_risk = round(float(np.clip(1.0 - placement, 0.0, 1.0)), 4)
    top_factor = _compute_top_factor_from_breakdown(breakdown)

    # Keep model artifact available but not used for core score (user wants placement-only)
    # Still compute threshold-based at_risk from risk
    at_risk = academic_risk >= 0.35  # Needs attention threshold

    return {
        "academic_risk": academic_risk,
        "placement_readiness": placement,
        "top_factor": top_factor,
        "at_risk": at_risk,
        "breakdown": breakdown,
    }


# ── Legacy shim (kept for compatibility, now delegates to new formula) ─

def _compute_placement_readiness(features: dict[str, float | int], academic_risk: float) -> float:  # noqa: ARG001
    """Legacy signature — now just calls new placement logic."""
    p, _ = _compute_placement_readiness_new(features, None)
    return p


# ── Intervention snapshot logic ──────────────────────────────────────

def record_intervention_risk_before(intervention_id: str, features: dict[str, float | int]) -> dict:
    from services.supabase_client import get_supabase_client
    prediction = predict_risk(features)
    supabase = get_supabase_client()
    supabase.table("interventions").update({"risk_before": prediction["academic_risk"]}).eq("id", intervention_id).execute()
    return {"intervention_id": intervention_id, "risk_before": prediction["academic_risk"], "top_factor": prediction["top_factor"]}


def compute_intervention_risk_after(intervention_id: str, features: dict[str, float | int], *, review_date: date | None = None) -> dict:
    from services.supabase_client import get_supabase_client
    if review_date is not None and review_date > date.today():
        raise ValueError("Review date has not been reached yet")
    supabase = get_supabase_client()
    row = supabase.table("interventions").select("risk_before, review_date").eq("id", intervention_id).single().execute()
    data = row.data or {}
    stored_review = data.get("review_date")
    if stored_review and date.fromisoformat(str(stored_review)) > date.today():
        raise ValueError("Review date has not been reached yet")
    prediction = predict_risk(features)
    risk_after = prediction["academic_risk"]
    risk_before = float(data.get("risk_before") or 0.0)
    delta = round(risk_before - risk_after, 4)
    supabase.table("interventions").update({"risk_after": risk_after}).eq("id", intervention_id).execute()
    return {"intervention_id": intervention_id, "risk_before": risk_before, "risk_after": risk_after, "delta": delta, "improved": delta > 0}
