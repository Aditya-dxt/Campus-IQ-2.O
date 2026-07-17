"""Lazy-loaded risk model with graceful fallback when artifact is missing.

Provides:
- predict_risk(features) -> {academic_risk, placement_readiness, top_factor, at_risk}
- record_intervention_risk_before(intervention_id, features) -> snapshot
- compute_intervention_risk_after(intervention_id, features) -> delta report

The model is loaded once on first use and cached for the lifetime of the process.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

import joblib
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
    """Check whether the trained model file exists on disk."""
    return MODEL_PATH.exists()


def _load_artifact() -> dict[str, Any]:
    """Lazy-load the model artifact from disk (cached after first call)."""
    global _ARTIFACT
    if _ARTIFACT is not None:
        return _ARTIFACT
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Risk model not found at {MODEL_PATH}. Run ml/predictor/train.py first."
        )
    _ARTIFACT = joblib.load(MODEL_PATH)
    return _ARTIFACT


def _classifier():
    return _load_artifact()["classifier"]


def _threshold() -> float:
    return float(_load_artifact().get("threshold", 0.5))


def _model_name() -> str:
    artifact = _load_artifact()
    return artifact.get("model_name", type(artifact["classifier"]).__name__)


# ── SHAP-based feature attribution ──────────────────────────────────

def _feature_contributions(features_df: pd.DataFrame) -> np.ndarray:
    """Compute per-feature SHAP contributions for a single student.

    Returns a 1-D array of shape (n_features,).
    """
    classifier = _classifier()
    cls_name = type(classifier).__name__

    if cls_name == "XGBClassifier":
        import xgboost as xgb
        dmatrix = xgb.DMatrix(features_df)
        contribs = classifier.get_booster().predict(dmatrix, pred_contribs=True)
        return np.asarray(contribs)[0][:-1]

    # RandomForest or other tree-based models → use SHAP TreeExplainer
    import shap
    explainer = shap.TreeExplainer(classifier)
    shap_values = explainer.shap_values(features_df)
    if isinstance(shap_values, list):
        shap_values = shap_values[1]  # class-1 (at_risk) contributions
    return np.asarray(shap_values)[0]


def _features_frame(features: dict[str, float | int]) -> pd.DataFrame:
    """Convert a features dict to a single-row DataFrame in canonical column order."""
    row = {name: float(features[name]) for name in FEATURE_NAMES}
    return pd.DataFrame([row])


def _compute_top_factor(features_df: pd.DataFrame) -> str:
    """Return the human-readable name of the feature most driving risk up."""
    values = _feature_contributions(features_df)
    # Look for the largest positive SHAP value (pushing towards at-risk)
    positives = np.where(values > 0, values, 0.0)
    if positives.max() > 0:
        idx = int(np.argmax(positives))
    else:
        # No positive contributions → pick the largest absolute contributor
        idx = int(np.argmax(np.abs(values)))
    raw_name = FEATURE_NAMES[idx]
    return FEATURE_LABELS.get(raw_name, raw_name)


# ── Placement readiness score ────────────────────────────────────────

def _compute_placement_readiness(
    features: dict[str, float | int], academic_risk: float
) -> float:
    """Weighted composite of career-readiness indicators.

    Weights: marks(30%), mock-interview(25%), resume-scans(20%),
             career-chat(15%), inverse-risk(10%).
    """
    marks_norm = float(features["past_marks"]) / 100.0
    interview_norm = float(features["mock_interview_score"]) / 100.0
    resume_norm = min(float(features["resume_scans_count"]) / 10.0, 1.0)
    chat_norm = min(float(features["career_chat_activity_count"]) / 20.0, 1.0)

    readiness = (
        0.30 * marks_norm
        + 0.25 * interview_norm
        + 0.20 * resume_norm
        + 0.15 * chat_norm
        + 0.10 * (1.0 - academic_risk)
    )
    return round(float(np.clip(readiness, 0.0, 1.0)), 4)


# ── Main prediction API ─────────────────────────────────────────────

def predict_risk(features: dict[str, float | int]) -> dict[str, float | str | bool]:
    """Predict academic risk for a single student.

    Args:
        features: Dict with keys matching FEATURE_NAMES.

    Returns:
        {
            "academic_risk": float (0-1 probability),
            "placement_readiness": float (0-1 composite score),
            "top_factor": str (human-readable risk factor),
            "at_risk": bool (True if above threshold),
        }
    """
    features_df = _features_frame(features)
    prob = float(_classifier().predict_proba(features_df)[0, 1])
    academic_risk = round(prob, 4)
    placement_readiness = _compute_placement_readiness(features, academic_risk)
    top_factor = _compute_top_factor(features_df)

    return {
        "academic_risk": academic_risk,
        "placement_readiness": placement_readiness,
        "top_factor": top_factor,
        "at_risk": prob >= _threshold(),
    }


# ── Intervention snapshot logic ──────────────────────────────────────

def record_intervention_risk_before(
    intervention_id: str, features: dict[str, float | int]
) -> dict:
    """Record the student's risk score when a mentor logs an intervention.

    Call this when the mentor creates/logs a new intervention action.
    Saves risk_before to the interventions table in Supabase.
    """
    from services.supabase_client import get_supabase_client

    prediction = predict_risk(features)
    supabase = get_supabase_client()
    supabase.table("interventions").update(
        {"risk_before": prediction["academic_risk"]}
    ).eq("id", intervention_id).execute()

    return {
        "intervention_id": intervention_id,
        "risk_before": prediction["academic_risk"],
        "top_factor": prediction["top_factor"],
    }


def compute_intervention_risk_after(
    intervention_id: str,
    features: dict[str, float | int],
    *,
    review_date: date | None = None,
) -> dict:
    """Compute risk_after and the delta once the review_date is reached.

    Call this when the scheduled review date has arrived (or passed).
    Compares current risk against the stored risk_before snapshot.

    Returns:
        {
            "intervention_id": str,
            "risk_before": float,
            "risk_after": float,
            "delta": float (positive = improvement),
            "improved": bool,
        }
    """
    from services.supabase_client import get_supabase_client

    if review_date is not None and review_date > date.today():
        raise ValueError("Review date has not been reached yet")

    supabase = get_supabase_client()
    row = (
        supabase.table("interventions")
        .select("risk_before, review_date")
        .eq("id", intervention_id)
        .single()
        .execute()
    )
    data = row.data or {}
    stored_review = data.get("review_date")
    if stored_review and date.fromisoformat(str(stored_review)) > date.today():
        raise ValueError("Review date has not been reached yet")

    prediction = predict_risk(features)
    risk_after = prediction["academic_risk"]
    risk_before = float(data.get("risk_before") or 0.0)
    delta = round(risk_before - risk_after, 4)

    supabase.table("interventions").update(
        {"risk_after": risk_after}
    ).eq("id", intervention_id).execute()

    return {
        "intervention_id": intervention_id,
        "risk_before": risk_before,
        "risk_after": risk_after,
        "delta": delta,
        "improved": delta > 0,
    }
