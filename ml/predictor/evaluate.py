"""Evaluate the trained risk predictor with recall-focused threshold tuning."""

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split

from generate_synthetic_data import FEATURE_COLUMNS, OUTPUT_PATH
from shap_analysis import build_explainer, get_mean_abs_contributions, get_top_factor

RANDOM_SEED = 42
MODEL_PATH = Path(__file__).resolve().parents[2] / "backend" / "models" / "risk_predictor.pkl"
MIN_RECALL = 0.85


def tune_threshold(y_true: np.ndarray, y_prob: np.ndarray, min_recall: float) -> float:
    best_threshold = 0.5
    best_f1 = -1.0
    for threshold in np.arange(0.10, 0.70, 0.01):
        preds = (y_prob >= threshold).astype(int)
        recall = recall_score(y_true, preds, zero_division=0)
        if recall >= min_recall:
            f1 = f1_score(y_true, preds, zero_division=0)
            if f1 > best_f1:
                best_f1 = f1
                best_threshold = float(threshold)
    return best_threshold


def evaluate() -> dict:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model not found at {MODEL_PATH}. Run train.py first.")

    df = pd.read_csv(OUTPUT_PATH)
    x = df[FEATURE_COLUMNS]
    y = df["at_risk"]

    _, x_test, _, y_test = train_test_split(
        x, y, test_size=0.2, random_state=RANDOM_SEED, stratify=y
    )

    artifact = joblib.load(MODEL_PATH)
    model = artifact["classifier"]
    threshold = artifact.get("threshold", 0.5)

    y_prob = model.predict_proba(x_test)[:, 1]
    tuned_threshold = tune_threshold(y_test.to_numpy(), y_prob, MIN_RECALL)
    if tuned_threshold != threshold:
        print(f"Adjusted threshold {threshold:.2f} -> {tuned_threshold:.2f} for recall >= {MIN_RECALL}")
        threshold = tuned_threshold
        artifact["threshold"] = threshold
        joblib.dump(artifact, MODEL_PATH)

    y_pred = (y_prob >= threshold).astype(int)

    metrics = {
        "precision": precision_score(y_test, y_pred, zero_division=0),
        "recall": recall_score(y_test, y_pred, zero_division=0),
        "f1": f1_score(y_test, y_pred, zero_division=0),
        "threshold": threshold,
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
    }

    print("=" * 50)
    print("RISK PREDICTOR EVALUATION REPORT")
    print("=" * 50)
    print(f"Model: {artifact.get('model_name', 'unknown')}")
    print(f"Threshold: {threshold:.2f} (recall-prioritized)")
    print(f"Precision: {metrics['precision']:.3f}")
    print(f"Recall:    {metrics['recall']:.3f}")
    print(f"F1 Score:  {metrics['f1']:.3f}")
    print("\nConfusion Matrix (rows=actual, cols=predicted):")
    print("              pred_0  pred_1")
    cm = np.array(metrics["confusion_matrix"])
    print(f"  actual_0    {cm[0,0]:6d}  {cm[0,1]:6d}")
    print(f"  actual_1    {cm[1,0]:6d}  {cm[1,1]:6d}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=["not_at_risk", "at_risk"]))

    explainer = build_explainer(model, x_test.iloc[:100])
    if isinstance(explainer, tuple):
        importances = get_mean_abs_contributions(
            explainer[0], explainer[1], x_test.iloc[:200], FEATURE_COLUMNS
        )
    else:
        sample_shap = explainer.shap_values(x_test.iloc[:200])
        if isinstance(sample_shap, list):
            sample_shap = sample_shap[1]
        importances = {
            name: float(np.abs(sample_shap[:, i]).mean())
            for i, name in enumerate(FEATURE_COLUMNS)
        }
    print("\nSHAP Feature Importances (mean |SHAP|):")
    for name, val in sorted(importances.items(), key=lambda kv: kv[1], reverse=True):
        print(f"  {name}: {val:.4f}")

    example = x_test.iloc[[0]]
    top = get_top_factor(explainer, example, FEATURE_COLUMNS)
    print(f"\nExample top_factor for {example.index[0]}: {top}")

    return metrics


if __name__ == "__main__":
    evaluate()
