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

- Resume scoring
- RAG study chatbot (Fully offline using Local Phi-3-mini)
- Academic risk & placement readiness prediction
- Smart scheduler
- Mentor intervention feedback loop

## Project structure

```
campusiq/
  frontend/          # React SPA
  backend/           # FastAPI API
    routers/
    services/
    models/
  ml/                # ML pipelines & eval
    resume_matching/
    rag_eval/
    predictor/
```

## Setup

### Environment

```bash
cp .env.example .env
# Fill in your keys in .env
```

### Backend

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Health check: `GET http://localhost:8000/` → `{"status": "ok"}`

Run migrations in the Supabase SQL editor:

- `backend/migrations/001_init.sql`
- `backend/migrations/002_student_profiles.sql`

#### Train risk predictor

Uses a synthetic dataset (~1500 rows) augmented with the [Kaggle Students Performance](https://www.kaggle.com/datasets/spscientist/students-performance-in-exams) CSV when placed at `ml/predictor/dataset/kaggle_students_performance.csv`.

```bash
cd ml/predictor
python generate_synthetic_data.py   # build students.csv
python train.py                     # saves backend/models/risk_predictor.pkl
python evaluate.py                  # recall-prioritized metrics + SHAP report
python shap_analysis.py             # optional feature attribution demo
```

#### API routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| POST | `/auth/signup` | Register (student or mentor) |
| POST | `/auth/login` | Login, returns JWT with role |
| GET | `/auth/me` | Current user from JWT (Bearer token) |
| GET | `/predict/` | Predict module status |
| GET | `/predict/dashboard` | Student risk summary (JWT, student) |
| GET | `/predict/students` | All students + scores (JWT, mentor) |
| GET | `/predict/students/{id}` | Single student (JWT, mentor) |
| GET | `/predict/cohort` | Cohort risk distribution (JWT, mentor) |
| POST | `/predict/score` | Score raw features (JWT) |
| GET | `/resume/` | Stub |
| GET | `/chat/` | Stub |
| GET | `/schedule/` | Stub |
| GET | `/intervention/` | Stub |

Protected routes use `Authorization: Bearer <token>`. Mentor-only routes use the `RequireMentor` dependency from `backend/dependencies.py`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### ML (optional separate venv)

```bash
cd ml
python -m venv venv
pip install -r ../backend/requirements.txt
```

## Roles

- **Student** — resume, chatbot, predictions, scheduler
- **Mentor / Admin** — interventions, feedback loop
