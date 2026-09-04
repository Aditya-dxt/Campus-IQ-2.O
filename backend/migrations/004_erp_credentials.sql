-- ERP credentials storage for one-time connect + refresh
-- Run in Supabase SQL editor after 002_student_profiles.sql
-- Stores ERP roll no + password so dashboard refresh can re-sync without re-entering

-- Optional: extend student_profiles with ERP fields (if you prefer single-table)
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS erp_id TEXT;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS erp_password TEXT;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS erp_last_synced TIMESTAMPTZ;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS erp_attendance JSONB;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS erp_marks JSONB;

-- Dedicated credentials table (alternative, cleaner separation)
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
-- Allow service role full access; add policies if using anon key directly:
-- CREATE POLICY "Users can manage own ERP creds" ON erp_credentials FOR ALL USING (auth.uid() = user_id);
