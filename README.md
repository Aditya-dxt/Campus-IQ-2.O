# CampusIQ

AI-powered academic & career copilot — full-stack college major project.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React (Vite), React Router, Tailwind CSS, Recharts, Axios, Context API |
| Backend | FastAPI, Python |
| Database | Supabase (Postgres) |
| Vector store | Chroma |
| LLM | Local Offline LLM (Phi-3-mini, llama-cpp-python) |
| ML | scikit-learn, XGBoost, SHAP, sentence-transformers, spaCy |

## Modules

- **Resume Scoring**: Semantic similarity + NLP keyword extraction against a Job Description.
- **RAG Study Chatbot**: Local offline AI (Phi-3-mini) for querying uploaded PDFs/DOCX.
- **Academic Risk Predictor**: XGBoost model predicting student failure/success with SHAP feature attribution.
- **Smart Scheduler**: Rule-based priority engine generating weekly study plans based on deadlines and risk.
- **Mentor Intervention Loop**: Closed-loop tracking (`risk_before` -> `action` -> `risk_after`) for cohort management.

## Project Structure

```
campusiq/
  frontend/          # React SPA (Vite)
  backend/           # FastAPI API
    routers/         # REST API endpoints
    services/        # ML & database business logic
    models/          # Exported ML model artifacts (e.g. .pkl)
    scripts/         # Cron jobs and test utilities
  ml/                # ML pipelines & eval scripts
    resume_matching/ # Sentence Transformers & spaCy eval
    rag_eval/        # Anti-hallucination guardrail eval
    predictor/       # XGBoost training pipeline
  docs/              # Project report notes & documentation
```

## Setup

### Environment Variables

You need a Supabase project. Get your URL and Key from the Supabase dashboard.

Create `.env` in the `backend/` directory (or the root if specified by your deployment platform):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-key
JWT_SECRET=your-random-jwt-secret
JWT_EXPIRE_MINUTES=1440
CORS_ORIGINS=http://localhost:5173
```

Create a `.env` in the `frontend/` directory:
```env
VITE_API_URL=http://localhost:8000
```

### Backend Setup (FastAPI & ML)

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```
*Note: Upon first launch, the backend will automatically download the 3.8GB Phi-3-mini GGUF model into `backend/models/` if it does not exist.*

Health check: `GET http://localhost:8000/` → `{"status": "ok"}`

### Database Migrations
Run the following migrations in your Supabase SQL editor to set up the schema:
1. `backend/migrations/001_init.sql`
2. `backend/migrations/002_student_profiles.sql`

*(The init script covers users, resumes, risk_scores, interventions, and chat_feedback. The student_profiles script is needed for ML inputs).*

### Frontend Setup (React)

```bash
cd frontend
npm install
npm run dev
```

The frontend will run at `http://localhost:5173`.

---

## Live Demo Seeding & Testing

To populate your Supabase dashboard with realistic, backdated mentor interventions (so the UI shows visible improvement deltas), run the seed script. **You must first register at least one Mentor and one Student via the React frontend.**

```bash
cd backend
python scripts/seed_demo.py
```

To run a full end-to-end integration test (simulating signup, resume upload, RAG ingestion, and RBAC enforcement):
```bash
cd backend
python scripts/test_e2e.py
```

---

## API Routes

All endpoints (except `/` and `/auth/signup`, `/auth/login`) are protected and require `Authorization: Bearer <token>`.

| Method | Path | Description | Access |
|--------|------|-------------|--------|
| POST | `/auth/signup` | Register user | Public |
| POST | `/auth/login` | Login, returns JWT | Public |
| GET | `/auth/me` | Get current profile | Any Valid JWT |
| GET | `/predict/dashboard` | Student risk summary | Student Only |
| GET | `/predict/cohort` | Cohort risk distribution | Mentor Only |
| POST | `/resume/score` | Score PDF/DOCX via FormData | Any Valid JWT |
| POST | `/chat/ingest` | Upload syllabus to Chroma | Any Valid JWT |
| POST | `/chat/ask` | Query local Phi-3 RAG | Any Valid JWT |
| POST | `/schedule/generate` | Generate priority study plan | Any Valid JWT |
| POST | `/intervention/create`| Snapshot risk and log action | Mentor Only |

---

## Deployment (Vercel & Render)

### 1. Backend (Render)
- Connect your GitHub repo to Render as a "Web Service".
- The included `render.yaml` automatically configures the Build and Start commands.
- **Critical Requirement:** You MUST deploy to a paid tier (e.g., standard instance) with at least 4-8GB of RAM. Free tiers (512MB RAM) will crash with an Out-Of-Memory (OOM) error when attempting to load the 3.8GB Phi-3 LLM.
- Set `SUPABASE_URL`, `SUPABASE_KEY`, and `JWT_SECRET` in the Render dashboard.
- Set `CORS_ORIGINS=*` to allow the Vercel frontend to connect.

### 2. Frontend (Vercel)
- Import the repo into Vercel.
- Set the Root Directory to `frontend`.
- Add `VITE_API_URL` to your Vercel Environment Variables, pointing to your deployed Render URL.
- Deploy!

## Roles

- **Student** — Has access to Resume Scanner, RAG Chatbot, personal risk predictions, and study scheduler. Cannot view cohort data.
- **Mentor** — Has access to the global cohort risk table, detailed analytics per student, and the intervention tracking system.
