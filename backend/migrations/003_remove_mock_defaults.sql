-- 003_remove_mock_defaults.sql
-- Applied live on 2026-09-04 via psycopg2 (db.yfysfwsnxqqrgdtagkyk.supabase.co)
-- Converts NOT NULL DEFAULT 75/65/0.75 etc into nullable columns and clears existing mock rows
-- Safe to re-run (idempotent)

ALTER TABLE student_profiles
  ALTER COLUMN attendance_pct DROP NOT NULL,
  ALTER COLUMN attendance_pct DROP DEFAULT,
  ALTER COLUMN past_marks DROP NOT NULL,
  ALTER COLUMN past_marks DROP DEFAULT,
  ALTER COLUMN submission_rate DROP NOT NULL,
  ALTER COLUMN submission_rate DROP DEFAULT,
  ALTER COLUMN login_frequency DROP NOT NULL,
  ALTER COLUMN login_frequency DROP DEFAULT,
  ALTER COLUMN resume_scans_count DROP NOT NULL,
  ALTER COLUMN resume_scans_count DROP DEFAULT,
  ALTER COLUMN mock_interview_score DROP NOT NULL,
  ALTER COLUMN mock_interview_score DROP DEFAULT,
  ALTER COLUMN career_chat_activity_count DROP NOT NULL,
  ALTER COLUMN career_chat_activity_count DROP DEFAULT;

-- Clear rows that still hold the original mock defaults (authentic empty state)
UPDATE student_profiles
SET attendance_pct = NULL, past_marks = NULL,
    submission_rate = NULL, login_frequency = NULL,
    resume_scans_count = NULL, mock_interview_score = NULL,
    career_chat_activity_count = NULL,
    updated_at = NOW()
WHERE attendance_pct = 75 AND past_marks = 65
  AND submission_rate = 0.75 AND login_frequency = 5
  AND resume_scans_count = 2 AND mock_interview_score = 60
  AND career_chat_activity_count = 3;

-- Clear rows where only past_marks etc still mock but attendance is real (e.g. after first ERP sync)
UPDATE student_profiles
SET past_marks = NULL, submission_rate = NULL, login_frequency = NULL,
    resume_scans_count = NULL, mock_interview_score = NULL,
    career_chat_activity_count = NULL
WHERE past_marks = 65 AND submission_rate = 0.75 AND login_frequency = 5
  AND resume_scans_count = 2 AND mock_interview_score = 60;
