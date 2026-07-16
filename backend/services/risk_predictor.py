"""Lazy-loaded risk model with graceful fallback when artifact is missing."""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from services.supabase_client import get_supabase_client

MODEL_PATH = Path(__file__).resolve().parents[1] / "models" / "risk_predictor.pkl"

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

_ARTIFACT: dict[str, Any] | None = None


def model_available() -> bool:
    return MODEL_PATH.exists()


def _load_artifact() -> dict[str, Any]:
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


def _feature_contributions(features_df: pd.DataFrame) -> np.ndarray:
    classifier = _classifier()
    if _model_name() == "xgboost" or type(classifier).__name__ == "XGBClassifier":
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


def _compute_top_factor(features_df: pd.DataFrame) -> str:
    values = _feature_contributions(features_df)
    positives = np.where(values > 0, values, 0.0)
    if positives.max() > 0:
        idx = int(np.argmax(positives))
    else:
        idx = int(np.argmax(np.abs(values)))
    raw_name = FEATURE_NAMES[idx]
    return FEATURE_LABELS.get(raw_name, raw_name)


def _compute_placement_readiness(features: dict[str, float | int], academic_risk: float) -> float:
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


def predict_risk(features: dict[str, float | int]) -> dict[str, float | str | bool]:
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


def record_intervention_risk_before(intervention_id: str, features: dict[str, float | int]) -> dict:
    prediction = predict_risk(features)
    supabase = get_supabase_client()
    supabase.table("interventions").update(
        {"risk_before": prediction["academic_risk"]}
    ).eq("id", intervention_id).execute()
    return {"intervention_id": intervention_id, "risk_before": prediction["academic_risk"]}


def compute_intervention_risk_after(
    intervention_id: str,
    features: dict[str, float | int],
    *,
    review_date: date | None = None,
) -> dict:
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

    supabase.table("interventions").update({"risk_after": risk_after}).eq(
        "id", intervention_id
    ).execute()

    return {
        "intervention_id": intervention_id,
        "risk_before": risk_before,
        "risk_after": risk_after,
        "delta": delta,
        "improved": delta > 0,
    }
