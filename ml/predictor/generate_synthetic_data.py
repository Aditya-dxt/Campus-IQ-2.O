"""Generate a realistic synthetic student dataset for risk prediction."""

from pathlib import Path

import numpy as np
import pandas as pd

RANDOM_SEED = 42
N_SAMPLES = 1500

FEATURE_COLUMNS = [
    "attendance_pct",
    "past_marks",
    "submission_rate",
    "login_frequency",
    "resume_scans_count",
    "mock_interview_score",
    "career_chat_activity_count",
]

OUTPUT_PATH = Path(__file__).resolve().parent / "dataset" / "students.csv"


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def generate_dataset(n_samples: int = N_SAMPLES, seed: int = RANDOM_SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    # Latent student engagement / academic profile (correlated features)
    latent_academic = rng.normal(0, 1, n_samples)
    latent_engagement = rng.normal(0, 1, n_samples)
    latent_career = rng.normal(0, 1, n_samples)

    attendance_pct = np.clip(
        55 + 18 * latent_academic + 8 * latent_engagement + rng.normal(0, 6, n_samples),
        20,
        100,
    )
    past_marks = np.clip(
        50 + 20 * latent_academic + 5 * latent_engagement + rng.normal(0, 8, n_samples),
        25,
        100,
    )
    submission_rate = np.clip(
        0.45 + 0.18 * latent_academic + 0.12 * latent_engagement + rng.normal(0, 0.08, n_samples),
        0.05,
        1.0,
    )
    login_frequency = np.clip(
        3 + 4 * latent_engagement + 2 * latent_career + rng.normal(0, 1.5, n_samples),
        0,
        25,
    ).astype(int)
    resume_scans_count = np.clip(
        rng.poisson(2 + np.maximum(latent_career, 0) * 2, n_samples),
        0,
        15,
    )
    mock_interview_score = np.clip(
        45 + 15 * latent_academic + 10 * latent_career + 8 * latent_engagement + rng.normal(0, 10, n_samples),
        20,
        100,
    )
    career_chat_activity_count = np.clip(
        rng.poisson(3 + np.maximum(latent_career, 0) * 3 + np.maximum(latent_engagement, 0), n_samples),
        0,
        40,
    )

    # Risk logit: low attendance/marks/submission strongly increase at-risk probability
    risk_logit = (
        -1.2
        - 0.045 * attendance_pct
        - 0.035 * past_marks
        - 3.2 * submission_rate
        - 0.025 * mock_interview_score
        - 0.08 * login_frequency
        - 0.12 * resume_scans_count
        - 0.06 * career_chat_activity_count
        + rng.normal(0, 0.35, n_samples)
    )
    at_risk_prob = _sigmoid(risk_logit)
    at_risk = (at_risk_prob > 0.42).astype(int)

    # Ensure meaningful class balance (~25-35% at risk)
    if at_risk.mean() < 0.2 or at_risk.mean() > 0.45:
        at_risk = (at_risk_prob > np.quantile(at_risk_prob, 0.68)).astype(int)

    df = pd.DataFrame(
        {
            "student_id": [f"STU-{i:05d}" for i in range(1, n_samples + 1)],
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


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    synthetic = generate_dataset()
    try:
        from prepare_kaggle_base import merge_kaggle_and_synthetic

        df = merge_kaggle_and_synthetic(synthetic)
        if len(df) > len(synthetic):
            print(f"Merged Kaggle base ({len(df) - len(synthetic)} rows) with synthetic data")
    except Exception as exc:
        print(f"Kaggle merge skipped: {exc}")
        df = synthetic
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"Saved {len(df)} rows to {OUTPUT_PATH}")
    print(f"At-risk rate: {df['at_risk'].mean():.1%}")
    print(df[FEATURE_COLUMNS + ["at_risk"]].corr()["at_risk"].sort_values())


if __name__ == "__main__":
    main()
