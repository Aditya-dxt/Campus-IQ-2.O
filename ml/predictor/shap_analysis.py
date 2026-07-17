"""SHAP-based feature attribution for the risk predictor.

Supports both XGBoost (native pred_contribs) and RandomForest (TreeExplainer).
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

FEATURE_LABELS = {
    "attendance_pct": "Low attendance",
    "past_marks": "Low past marks",
    "submission_rate": "Low assignment submission rate",
    "login_frequency": "Low platform login frequency",
    "resume_scans_count": "Few resume scans",
    "mock_interview_score": "Low mock interview score",
    "career_chat_activity_count": "Low career chat activity",
}


def build_explainer(
    model: Any, background: pd.DataFrame | None = None
) -> tuple[str, Any] | Any:
    """Return an explainer object for the given model.

    For XGBoost: returns ("xgboost", model) tuple using native pred_contribs.
    For RandomForest: returns a shap.TreeExplainer instance.
    For other models: returns a shap.Explainer using background data.
    """
    model_name = type(model).__name__

    if model_name == "XGBClassifier":
        return ("xgboost", model)

    if model_name == "RandomForestClassifier":
        import shap
        return ("tree", shap.TreeExplainer(model))

    # Generic fallback
    if background is not None:
        import shap
        return ("generic", shap.Explainer(model.predict_proba, background))

    import shap
    return ("tree", shap.TreeExplainer(model))


def _get_shap_values(
    explainer_kind: str, explainer_obj: Any, features: pd.DataFrame
) -> np.ndarray:
    """Compute SHAP contribution values for a single row of features.

    Returns a 1-D array of shape (n_features,).
    """
    if explainer_kind == "xgboost":
        import xgboost as xgb
        dmatrix = xgb.DMatrix(features)
        contribs = explainer_obj.get_booster().predict(dmatrix, pred_contribs=True)
        return np.asarray(contribs)[0][:-1]  # drop bias term

    if explainer_kind == "tree":
        shap_values = explainer_obj.shap_values(features)
        # For binary classification, TreeExplainer returns a list of two arrays
        if isinstance(shap_values, list):
            shap_values = shap_values[1]  # class-1 (at_risk) contributions
        arr = np.asarray(shap_values)
        if arr.ndim == 2:
            return arr[0]
        return arr

    if explainer_kind == "generic":
        shap_values = explainer_obj(features)
        vals = shap_values.values
        if vals.ndim == 3:
            vals = vals[:, :, 1]
        return vals[0]

    raise TypeError(f"Unsupported explainer kind: {explainer_kind}")


def _get_batch_shap_values(
    explainer_kind: str, explainer_obj: Any, features: pd.DataFrame
) -> np.ndarray:
    """Compute SHAP values for multiple rows. Returns (n_samples, n_features)."""
    if explainer_kind == "xgboost":
        import xgboost as xgb
        dmatrix = xgb.DMatrix(features)
        contribs = explainer_obj.get_booster().predict(dmatrix, pred_contribs=True)
        return np.asarray(contribs)[:, :-1]

    if explainer_kind == "tree":
        shap_values = explainer_obj.shap_values(features)
        if isinstance(shap_values, list):
            shap_values = shap_values[1]
        return np.asarray(shap_values)

    if explainer_kind == "generic":
        shap_values = explainer_obj(features)
        vals = shap_values.values
        if vals.ndim == 3:
            vals = vals[:, :, 1]
        return vals

    raise TypeError(f"Unsupported explainer kind: {explainer_kind}")


def get_top_factor(
    explainer: tuple[str, Any],
    features: pd.DataFrame,
    feature_names: list[str],
) -> str:
    """Return the single feature that contributed most to elevated risk.

    Looks for the largest positive SHAP value (feature pushing towards at-risk).
    If no positive contributions exist, falls back to the largest absolute value.
    """
    explainer_kind, explainer_obj = explainer
    values = _get_shap_values(explainer_kind, explainer_obj, features)

    positives = np.where(values > 0, values, 0.0)
    if positives.max() > 0:
        idx = int(np.argmax(positives))
    else:
        idx = int(np.argmax(np.abs(values)))

    raw_name = feature_names[idx]
    return FEATURE_LABELS.get(raw_name, raw_name)


def get_mean_abs_contributions(
    explainer_kind: str,
    explainer_obj: Any,
    features: pd.DataFrame,
    feature_names: list[str],
) -> dict[str, float]:
    """Compute mean absolute SHAP contributions across a batch of samples."""
    shap_matrix = _get_batch_shap_values(explainer_kind, explainer_obj, features)
    mean_abs = np.abs(shap_matrix).mean(axis=0)
    return {
        name: float(val)
        for name, val in zip(feature_names, mean_abs, strict=True)
    }
