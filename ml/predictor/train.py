"""Train and compare XGBoost vs RandomForest risk classifiers.

Trains both models on the synthetic+Kaggle student dataset, compares them
on held-out test data with recall-prioritized threshold tuning, and saves
the better-performing model artifact to backend/models/risk_predictor.pkl.
"""

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import f1_score, precision_score, recall_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict, train_test_split
from xgboost import XGBClassifier

from generate_synthetic_data import FEATURE_COLUMNS, OUTPUT_PATH

RANDOM_SEED = 42
MODEL_PATH = Path(__file__).resolve().parents[2] / "backend" / "models" / "risk_predictor.pkl"
MIN_RECALL = 0.85


def load_data() -> tuple[pd.DataFrame, pd.Series]:
    """Load the student dataset and split into features/target."""
    df = pd.read_csv(OUTPUT_PATH)
    x = df[FEATURE_COLUMNS]
    y = df["at_risk"]
    print(f"Dataset: {len(df)} rows, at-risk rate: {y.mean():.1%}")
    return x, y


def find_recall_threshold(
    y_true: np.ndarray, y_prob: np.ndarray, min_recall: float = MIN_RECALL
) -> float:
    """Find the highest threshold that still meets minimum recall.

    Among thresholds achieving recall >= min_recall, pick the one that
    maximizes F1 (best precision/recall tradeoff while staying safe).
    """
    best_threshold = 0.30  # Conservative default
    best_f1 = -1.0
    for threshold in np.arange(0.10, 0.65, 0.005):
        preds = (y_prob >= threshold).astype(int)
        recall = recall_score(y_true, preds, zero_division=0)
        if recall >= min_recall:
            f1 = f1_score(y_true, preds, zero_division=0)
            if f1 > best_f1:
                best_f1 = f1
                best_threshold = float(threshold)
    return best_threshold


def train_models(x_train, x_test, y_train, y_test):
    """Train XGBoost and RandomForest, compare, and return best artifact."""
    # Compute class imbalance ratio for XGBoost
    neg_count = int((y_train == 0).sum())
    pos_count = int((y_train == 1).sum())
    scale_pos = neg_count / max(pos_count, 1)

    models = {
        "xgboost": XGBClassifier(
            n_estimators=250,
            max_depth=5,
            learning_rate=0.08,
            subsample=0.9,
            colsample_bytree=0.9,
            scale_pos_weight=scale_pos,
            random_state=RANDOM_SEED,
            eval_metric="logloss",
        ),
        "random_forest": RandomForestClassifier(
            n_estimators=300,
            max_depth=12,
            min_samples_leaf=3,
            class_weight="balanced",
            random_state=RANDOM_SEED,
            n_jobs=-1,
        ),
    }

    print(f"\nTraining set: {len(x_train)} samples (at-risk: {y_train.mean():.1%})")
    print(f"Test set:     {len(x_test)} samples  (at-risk: {y_test.mean():.1%})")
    print(f"Class ratio (neg/pos): {scale_pos:.2f}")
    print("-" * 60)

    results = {}
    for name, model in models.items():
        print(f"\nTraining {name}...")
        model.fit(x_train, y_train)
        prob = model.predict_proba(x_test)[:, 1]
        threshold = find_recall_threshold(y_test.to_numpy(), prob)
        preds = (prob >= threshold).astype(int)

        r = recall_score(y_test, preds, zero_division=0)
        p = precision_score(y_test, preds, zero_division=0)
        f = f1_score(y_test, preds, zero_division=0)

        results[name] = {
            "model": model,
            "threshold": threshold,
            "recall": r,
            "precision": p,
            "f1": f,
        }
        print(
            f"  {name}: precision={p:.3f}  recall={r:.3f}  "
            f"f1={f:.3f}  threshold={threshold:.3f}"
        )

    # Select best: among models meeting recall threshold, pick highest F1
    qualified = {k: v for k, v in results.items() if v["recall"] >= MIN_RECALL}
    if qualified:
        best_name = max(qualified, key=lambda k: qualified[k]["f1"])
    else:
        # Fallback: if none meets threshold, pick highest recall anyway
        best_name = max(results, key=lambda k: (results[k]["recall"], results[k]["f1"]))
    best = results[best_name]
    print(f"\n{'=' * 60}")
    print(f"  SELECTED MODEL: {best_name}")
    print(f"  Recall={best['recall']:.3f}  F1={best['f1']:.3f}  Threshold={best['threshold']:.3f}")
    print(f"{'=' * 60}")

    artifact = {
        "model_name": best_name,
        "classifier": best["model"],
        "feature_names": FEATURE_COLUMNS,
        "threshold": best["threshold"],
    }
    return artifact


def main() -> None:
    """Main entry point: generate data if needed, train, save model."""
    if not OUTPUT_PATH.exists():
        from generate_synthetic_data import main as generate_main
        generate_main()

    x, y = load_data()
    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.2, random_state=RANDOM_SEED, stratify=y
    )

    artifact = train_models(x_train, x_test, y_train, y_test)
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, MODEL_PATH)
    print(f"\nModel artifact saved to {MODEL_PATH}")
    print(f"Artifact keys: {list(artifact.keys())}")


if __name__ == "__main__":
    main()
