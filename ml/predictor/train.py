"""Train and compare XGBoost vs RandomForest risk classifiers."""

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import f1_score, recall_score
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

from generate_synthetic_data import FEATURE_COLUMNS, OUTPUT_PATH

RANDOM_SEED = 42
MODEL_PATH = Path(__file__).resolve().parents[2] / "backend" / "models" / "risk_predictor.pkl"


def load_data() -> tuple[pd.DataFrame, pd.Series]:
    df = pd.read_csv(OUTPUT_PATH)
    x = df[FEATURE_COLUMNS]
    y = df["at_risk"]
    return x, y


def find_recall_threshold(y_true: np.ndarray, y_prob: np.ndarray, min_recall: float = 0.85) -> float:
    """Pick the highest threshold that still meets minimum recall."""
    best_threshold = 0.5
    for threshold in np.arange(0.15, 0.65, 0.01):
        preds = (y_prob >= threshold).astype(int)
        recall = recall_score(y_true, preds, zero_division=0)
        if recall >= min_recall:
            best_threshold = float(threshold)
    return best_threshold


def train_models(x_train, x_test, y_train, y_test):
    models = {
        "xgboost": XGBClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.08,
            subsample=0.9,
            colsample_bytree=0.9,
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

    results = {}
    for name, model in models.items():
        model.fit(x_train, y_train)
        prob = model.predict_proba(x_test)[:, 1]
        threshold = find_recall_threshold(y_test.to_numpy(), prob)
        preds = (prob >= threshold).astype(int)
        results[name] = {
            "model": model,
            "threshold": threshold,
            "recall": recall_score(y_test, preds, zero_division=0),
            "f1": f1_score(y_test, preds, zero_division=0),
        }
        print(
            f"{name}: recall={results[name]['recall']:.3f} "
            f"f1={results[name]['f1']:.3f} threshold={threshold:.2f}"
        )

    best_name = max(results, key=lambda k: (results[k]["recall"], results[k]["f1"]))
    best = results[best_name]
    print(f"\nSelected model: {best_name}")

    artifact = {
        "model_name": best_name,
        "classifier": best["model"],
        "feature_names": FEATURE_COLUMNS,
        "threshold": best["threshold"],
    }
    return artifact


def main() -> None:
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
    print(f"Saved model artifact to {MODEL_PATH}")


if __name__ == "__main__":
    main()
