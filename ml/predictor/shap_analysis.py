"""SHAP-based feature attribution for the risk predictor."""

from typing import Any

import numpy as np
import pandas as pd
import shap
import xgboost as xgb

FEATURE_LABELS = {
    "attendance_pct": "Low attendance",
    "past_marks": "Low past marks",
    "submission_rate": "Low assignment submission rate",
    "login_frequency": "Low platform login frequency",
    "resume_scans_count": "Few resume scans",
    "mock_interview_score": "Low mock interview score",
    "career_chat_activity_count": "Low career chat activity",
}


def build_explainer(model: Any, background: pd.DataFrame | None = None):
    model_name = type(model).__name__
    if model_name == "XGBClassifier":
        return ("xgboost", model)
    if background is not None:
        return shap.Explainer(model.predict_proba, background)
    return shap.TreeExplainer(model)


def _contributions(model_kind: str, model: Any, features: pd.DataFrame) -> np.ndarray:
    if model_kind == "xgboost":
        dmatrix = xgb.DMatrix(features)
        contribs = model.get_booster().predict(dmatrix, pred_contribs=True)
        return np.asarray(contribs)[0][:-1]
    raise TypeError(f"Unsupported explainer kind: {model_kind}")


def get_top_factor(
    explainer: tuple[str, Any] | shap.Explainer | shap.TreeExplainer,
    features: pd.DataFrame,
    feature_names: list[str],
) -> str:
    """Return the single feature that contributed most to elevated risk."""
    if isinstance(explainer, tuple):
        values = _contributions(explainer[0], explainer[1], features)
    else:
        shap_values = explainer.shap_values(features)
        if isinstance(shap_values, list):
            shap_values = shap_values[1]
        values = np.asarray(shap_values)[0]

    positives = np.where(values > 0, values, 0.0)
    if positives.max() > 0:
        idx = int(np.argmax(positives))
    else:
        idx = int(np.argmax(np.abs(values)))
    raw_name = feature_names[idx]
    return FEATURE_LABELS.get(raw_name, raw_name)


def get_mean_abs_contributions(
    model_kind: str,
    model: Any,
    features: pd.DataFrame,
    feature_names: list[str],
) -> dict[str, float]:
    if model_kind == "xgboost":
        dmatrix = xgb.DMatrix(features)
        contribs = model.get_booster().predict(dmatrix, pred_contribs=True)
        mean_abs = np.abs(contribs[:, :-1]).mean(axis=0)
        return {name: float(val) for name, val in zip(feature_names, mean_abs, strict=True)}
    raise TypeError(f"Unsupported model kind: {model_kind}")
