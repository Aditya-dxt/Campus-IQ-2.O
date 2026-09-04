-- Mentor coordinator + student year/section for strict per-section isolation
-- Run in Supabase SQL editor after 004_erp_credentials.sql

-- Student year/section extracted from ERP (e.g. PSIT-CS-III-M → year III, section M)
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS year TEXT;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS section TEXT;

-- Mentor's assigned year-section (e.g. "CS-III-M" or "PSIT-CS-III-M")
ALTER TABLE users ADD COLUMN IF NOT EXISTS coordinator_section TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS coordinator_year TEXT;

-- Ensure ERP columns exist (idempotent if 004 already run)
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS erp_id TEXT;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS erp_password TEXT;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS erp_last_synced TIMESTAMPTZ;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS erp_attendance JSONB;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS erp_marks JSONB;

CREATE TABLE IF NOT EXISTS erp_credentials (
    user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    erp_id TEXT NOT NULL,
    erp_password TEXT NOT NULL,
    last_synced_at TIMESTAMPTZ,
    last_attendance_pct NUMERIC(5,2),
    last_marks_avg NUMERIC(5,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_erp_credentials_user_id ON erp_credentials (user_id);
ALTER TABLE erp_credentials ENABLE ROW LEVEL SECURITY;

-- Helpful indexes for mentor filtering
CREATE INDEX IF NOT EXISTS idx_student_profiles_section ON student_profiles (section);
CREATE INDEX IF NOT EXISTS idx_student_profiles_year ON student_profiles (year);
CREATE INDEX IF NOT EXISTS idx_users_coordinator_section ON users (coordinator_section);
