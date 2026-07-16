-- Student activity features for risk prediction
-- Run after 001_init.sql

CREATE TABLE student_profiles (
    user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    attendance_pct NUMERIC(5, 2) NOT NULL DEFAULT 75,
    past_marks NUMERIC(5, 2) NOT NULL DEFAULT 65,
    submission_rate NUMERIC(4, 3) NOT NULL DEFAULT 0.75,
    login_frequency INTEGER NOT NULL DEFAULT 5,
    resume_scans_count INTEGER NOT NULL DEFAULT 2,
    mock_interview_score NUMERIC(5, 2) NOT NULL DEFAULT 60,
    career_chat_activity_count INTEGER NOT NULL DEFAULT 3,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_student_profiles_user_id ON student_profiles (user_id);

ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
