-- CampusIQ initial schema
-- Run in the Supabase SQL editor or via psql against DATABASE_URL

CREATE TYPE user_role AS ENUM ('student', 'mentor');

CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role user_role NOT NULL DEFAULT 'student',
    branch TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    score NUMERIC(5, 2),
    missing_keywords TEXT[] DEFAULT '{}',
    suggestions TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    doc_id TEXT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    thumbs BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE risk_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    academic_risk NUMERIC(5, 4) NOT NULL,
    placement_readiness NUMERIC(5, 4) NOT NULL,
    top_factor TEXT,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE interventions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    mentor_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    action_note TEXT NOT NULL,
    risk_before NUMERIC(5, 4),
    risk_after NUMERIC(5, 4),
    review_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resumes_user_id ON resumes (user_id);
CREATE INDEX idx_chat_feedback_user_id ON chat_feedback (user_id);
CREATE INDEX idx_risk_scores_user_id ON risk_scores (user_id);
CREATE INDEX idx_interventions_student_id ON interventions (student_id);
CREATE INDEX idx_interventions_mentor_id ON interventions (mentor_id);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE interventions ENABLE ROW LEVEL SECURITY;
