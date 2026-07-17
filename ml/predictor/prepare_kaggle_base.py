"""Transform Kaggle Students Performance dataset into CampusIQ feature schema.

Source: https://www.kaggle.com/datasets/spscientist/students-performance-in-exams

Place the CSV as ml/predictor/dataset/kaggle_students_performance.csv
(columns: gender, race/ethnicity, parental level of education, lunch,
 test preparation course, math score, reading score, writing score)
"""

from pathlib import Path

import numpy as np
import pandas as pd

from generate_synthetic_data import FEATURE_COLUMNS

KAGGLE_PATH = Path(__file__).resolve().parent / "dataset" / "kaggle_students_performance.csv"


def load_kaggle_base(seed: int = 42) -> pd.DataFrame | None:
    if not KAGGLE_PATH.exists():
        return None

    raw = pd.read_csv(KAGGLE_PATH)
    required = {"math score", "reading score", "writing score"}
    if not required.issubset(set(raw.columns)):
        # normalize column names
        raw.columns = [c.strip().lower() for c in raw.columns]

    if not required.issubset(set(raw.columns)):
        raise ValueError(
            f"Kaggle CSV missing score columns. Found: {list(raw.columns)}"
        )

    rng = np.random.default_rng(seed)
    n = len(raw)
    past_marks = (
        raw["math score"].astype(float)
        + raw["reading score"].astype(float)
        + raw["writing score"].astype(float)
    ) / 3.0

    prep = raw.get("test preparation course", pd.Series(["none"] * n))
    prep_boost = prep.astype(str).str.lower().str.contains("completed").astype(float) * 8

    attendance_pct = np.clip(
        45 + 0.45 * past_marks + prep_boost + rng.normal(0, 7, n),
        20,
        100,
    )
    submission_rate = np.clip(
        0.35 + 0.005 * past_marks + 0.05 * prep_boost / 8 + rng.normal(0, 0.08, n),
        0.05,
        1.0,
    )
    login_frequency = np.clip(
        rng.poisson(2 + past_marks / 25, n),
        0,
        25,
    ).astype(int)
    resume_scans_count = np.clip(rng.poisson(1 + past_marks / 30, n), 0, 15)
    mock_interview_score = np.clip(
        past_marks * 0.85 + prep_boost + rng.normal(0, 8, n),
        20,
        100,
    )
    career_chat_activity_count = np.clip(
        rng.poisson(2 + past_marks / 20, n),
        0,
        40,
    )

    risk_logit = (
        -1.0
        - 0.04 * attendance_pct
        - 0.04 * past_marks
        - 2.8 * submission_rate
        - 0.02 * mock_interview_score
        + rng.normal(0, 0.3, n)
    )
    at_risk_prob = 1.0 / (1.0 + np.exp(-risk_logit))
    at_risk = (at_risk_prob > np.quantile(at_risk_prob, 0.68)).astype(int)

    df = pd.DataFrame(
        {
            "student_id": [f"KGL-{i:05d}" for i in range(1, n + 1)],
            "attendance_pct": np.round(attendance_pct, 1),
            "past_marks": np.round(past_marks, 1),
            "submission_rate": np.round(submission_rate, 3),
            "login_frequency": login_frequency,
            "resume_scans_count": resume_scans_count,
            "mock_interview_score": np.round(mock_interview_score, 1),
            "career_chat_activity_count": career_chat_activity_count,
            "at_risk": at_risk,
        }
    )
    return df


def merge_kaggle_and_synthetic(synthetic: pd.DataFrame, seed: int = 42) -> pd.DataFrame:
    kaggle = load_kaggle_base(seed=seed)
    if kaggle is None:
        return synthetic

    combined = pd.concat([kaggle, synthetic], ignore_index=True)
    combined["student_id"] = [f"STU-{i:05d}" for i in range(1, len(combined) + 1)]
    return combined
