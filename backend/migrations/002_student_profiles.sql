-- Student activity features for risk prediction
-- Run after 001_init.sql
-- Updated 2026-09-04: removed NOT NULL DEFAULTs so new accounts start empty (authentic, no mock data)
-- Real values are written only via POST /erp/connect

CREATE TABLE student_profiles (
    user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    attendance_pct NUMERIC(5, 2),
    past_marks NUMERIC(5, 2),
    submission_rate NUMERIC(4, 3),
    login_frequency INTEGER,
    resume_scans_count INTEGER,
    mock_interview_score NUMERIC(5, 2),
    career_chat_activity_count INTEGER,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_student_profiles_user_id ON student_profiles (user_id);

ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
