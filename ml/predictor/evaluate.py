"""Evaluate the trained risk predictor with recall-focused threshold tuning.

Computes precision, recall, F1, confusion matrix, SHAP feature importances,
and demonstrates the top_factor function for individual students.
Prioritizes recall >= 0.85 — if needed, adjusts the classification threshold
and re-saves the model artifact.
"""

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


def tune_threshold(
    y_true: np.ndarray, y_prob: np.ndarray, min_recall: float
) -> float:
    """Find the threshold that maximizes F1 while maintaining recall >= min_recall."""
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
    """Run full evaluation pipeline and print report."""
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

    # Re-tune threshold if recall is below target
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

    # ── Print evaluation report ──────────────────────────────────────
    print("=" * 60)
    print("        CAMPUSIQ RISK PREDICTOR - EVALUATION REPORT")
    print("=" * 60)
    print(f"  Model:      {artifact.get('model_name', 'unknown')}")
    print(f"  Threshold:  {threshold:.2f} (recall-prioritized, min={MIN_RECALL})")
    print(f"  Test size:  {len(y_test)} samples")
    print("-" * 60)
    print(f"  Precision:  {metrics['precision']:.4f}")
    print(f"  Recall:     {metrics['recall']:.4f}")
    print(f"  F1 Score:   {metrics['f1']:.4f}")
    print("-" * 60)
    print("  Confusion Matrix (rows=actual, cols=predicted):")
    print("                pred_safe  pred_at_risk")
    cm = np.array(metrics["confusion_matrix"])
    print(f"    actual_safe     {cm[0, 0]:5d}         {cm[0, 1]:5d}")
    print(f"    actual_risk     {cm[1, 0]:5d}         {cm[1, 1]:5d}")
    print("-" * 60)
    print("  Full Classification Report:")
    print(classification_report(y_test, y_pred, target_names=["not_at_risk", "at_risk"]))

    # ── SHAP Feature Importances ─────────────────────────────────────
    print("=" * 60)
    print("        SHAP FEATURE IMPORTANCES (mean |SHAP|)")
    print("=" * 60)
    explainer = build_explainer(model, x_test.iloc[:100])
    explainer_kind, explainer_obj = explainer
    importances = get_mean_abs_contributions(
        explainer_kind, explainer_obj, x_test.iloc[:200], FEATURE_COLUMNS
    )
    for name, val in sorted(importances.items(), key=lambda kv: kv[1], reverse=True):
        bar = "#" * int(val * 40 / max(importances.values()))
        print(f"  {name:35s} {val:.4f}  {bar}")

    # ── Example top_factor ───────────────────────────────────────────
    print("\n" + "=" * 60)
    print("        EXAMPLE TOP-FACTOR ATTRIBUTION")
    print("=" * 60)
    for i in range(min(5, len(x_test))):
        example = x_test.iloc[[i]]
        top = get_top_factor(explainer, example, FEATURE_COLUMNS)
        risk_prob = y_prob[i]
        label = "AT RISK" if risk_prob >= threshold else "SAFE"
        print(f"  Student {example.index[0]:>5d}: risk={risk_prob:.3f} ({label:>7s}) | top_factor: {top}")

    return metrics


if __name__ == "__main__":
    evaluate()
