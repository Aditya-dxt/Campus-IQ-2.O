# CampusIQ — AI Academic & Career Copilot

<p align="center">
  <img src="frontend/src/assets/hero.png" alt="CampusIQ" width="720" />
</p>

<p align="center">
  <a href="https://github.com/Aditya-dxt/Campus-IQ-2.O"><img alt="repo" src="https://img.shields.io/badge/repo-Campus--IQ--2.O-6366f1?style=flat-square" /></a>
  <img alt="stack" src="https://img.shields.io/badge/stack-React%20%7C%20FastAPI%20%7C%20Supabase-0ea5e9?style=flat-square" />
  <img alt="ml" src="https://img.shields.io/badge/ML-XGBoost%20%7C%20SHAP%20%7C%20Phi--3--mini-22c55e?style=flat-square" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-green?style=flat-square" />
  <img alt="offline" src="https://img.shields.io/badge/LLM-offline%20Phi--3--mini%20(GGUF)-a855f7?style=flat-square" />
</p>

> **Production-ready, privacy-first academic workspace** — resume scoring, RAG study chat (fully offline), risk prediction with SHAP explainability, smart weekly planner, and a closed-loop mentor intervention system. Role-based (Student / Mentor), ERP-connected, dark/light polished UI.

---

## Table of Contents

- [Highlights](#highlights)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Database — ER Diagram](#database--er-diagram)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Database Migrations](#database-migrations)
- [Running Locally](#running-locally)
- [API Reference](#api-reference)
- [Roles & Access Control](#roles--access-control)
- [Core Features Deep Dive](#core-features-deep-dive)
- [ML Pipelines](#ml-pipelines)
- [Deployment](#deployment)
- [Screenshots](#screenshots)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Highlights

| Module | What it does | Key tech |
|---|---|---|
| **Resume Scanner** | PDF/DOCX → ATS score vs Job Description (semantic + keyword) | `sentence-transformers`, `spaCy`, cosine similarity |
| **RAG Study Assistant** | Upload syllabus/notes → ask questions, grounded answers only | `Chroma`, `Phi-3-mini GGUF` via `llama-cpp-python`, anti-hallucination guardrail |
| **Risk Predictor** | Placement readiness & academic risk (0–1) with per-factor breakdown | `XGBoost`, `SHAP`, formula `0.40·marks + 0.30·attendance + 0.30·resume` |
| **Smart Scheduler** | Weekly plan from deadlines + weak subjects + risk — check-off progress | Rule-based priority engine, `localStorage` + event bus |
| **Intervention Loop** | Mentor logs action → snapshots `risk_before` → re-evaluates `risk_after` → delta | Closed-loop `interventions` table, RBAC cohort isolation |

Additional polish: **SHAP explainability bars** on Student Detail, **weekly progress ring** (real check-offs, not mock), **ERP sync** (attendance + marks live), **responsive** Tailwind UI with Navbar/Sidebar/AppLayout.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 + Vite 8, React Router 7, Tailwind CSS 4, Recharts, Axios, Context API |
| **Backend** | FastAPI, Python 3.10, Pydantic, PyJWT, Uvicorn |
| **Database** | Supabase (Postgres) — Row Level Security + JWT |
| **Vector Store** | Chroma (local `chroma_db_v3`) |
| **LLM** | Phi-3-mini GGUF (offline, `llama-cpp-python`) — no data leaves device |
| **ML** | scikit-learn, XGBoost, SHAP, sentence-transformers, spaCy, pandas/numpy/joblib |
| **Infra** | Render (backend), Vercel (frontend), `render.yaml` |
| **Auth** | Email/password + JWT (`JWT_SECRET`, `JWT_EXPIRE_MINUTES`), ERP one-time connect |

---

## Architecture

```mermaid
graph TB
    subgraph Client["Client — React SPA (Vite)"]
        A[Login / Signup]
        B[Student Dashboard]
        C[Mentor Dashboard]
        D[Resume Scanner]
        E[Study Assistant — RAG Chat]
        F[My Schedule — Weekly Planner]
        G[Student Detail — SHAP Explainability]
        CTX[AuthContext + Axios client]
    end

    subgraph API["Backend — FastAPI"]
        R1[routers/auth.py]
        R2[routers/erp.py]
        R3[routers/resume.py]
        R4[routers/chat.py]
        R5[routers/predict.py]
        R6[routers/schedule.py]
        R7[routers/intervention.py]
        S1[services/erp_psit.py]
        S2[services/resume_scorer.py]
        S3[services/rag_pipeline.py]
        S4[services/risk_predictor.py]
        S5[services/predict_service.py]
        S6[services/scheduler.py]
        S7[services/local_llm.py]
        S8[services/jwt_service.py]
    end

    subgraph Data["Data Layer"]
        SUP[(Supabase Postgres<br/>users, student_profiles,<br/>interventions, risk_scores)]
        CHROMA[(Chroma Vector Store<br/>chroma_db_v3)]
        MODELS[(Models<br/>risk_predictor.pkl<br/>phi3-mini.gguf)]
    end

    subgraph External["External (one-time)"]
        ERP[Campus ERP<br/>erp.psit.ac.in]
    end

    A --> CTX --> R1 --> S8 --> SUP
    B --> CTX --> R5 --> S5 --> S4 --> SUP
    B --> R2 --> S1 --> ERP --> SUP
    D --> R3 --> S2 --> SUP
    E --> R4 --> S3 --> CHROMA --> S7 --> MODELS
    F --> R6 --> S6
    G --> R7 --> S5 --> SUP
    C --> R7 --> SUP
    S4 --> MODELS
```

### Request Flow (Auth)

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant FE as React (AuthContext)
    participant BE as FastAPI
    participant DB as Supabase

    U->>FE: POST /auth/signup or /auth/login
    FE->>BE: { email, password, role, erp_id? }
    BE->>DB: verify / insert user
    BE-->>FE: { access_token (JWT), user }
    FE->>FE: store token, set Axios Authorization header
    U->>FE: Navigate (ProtectedRoute checks role)
    FE->>BE: GET /predict/dashboard (Bearer JWT)
    BE->>BE: dependencies.get_current_user()
    BE->>DB: fetch profile + risk
    BE-->>FE: dashboard payload
```

---

## Database — ER Diagram

```mermaid
erDiagram
    users ||--o| student_profiles : "1:1 (student)"
    users ||--o{ interventions : "mentor creates"
    student_profiles ||--o{ interventions : "1:N (student_id)"
    users ||--o{ risk_scores : "student has many"
    users ||--o{ resumes : "uploads"

    users {
        uuid id PK
        string email UK
        string password_hash
        string name
        string role "student | mentor"
        string branch
        string coordinator_section "mentor cohort, e.g. CS-III-M"
        string erp_id
        string erp_password_enc
        timestamp created_at
    }
    student_profiles {
        uuid user_id PK_FK
        float attendance_pct
        float past_marks
        float resume_score
        string year
        string section
        jsonb marks_by_test
        timestamp updated_at
    }
    interventions {
        uuid id PK
        uuid student_id FK
        uuid mentor_id FK
        string type
        string notes
        float risk_before
        float risk_after
        string status "pending | reviewed"
        date review_date
        timestamp created_at
    }
    risk_scores {
        uuid id PK
        uuid student_id FK
        float placement_readiness
        float academic_risk
        jsonb breakdown
        timestamp created_at
    }
```

Migrations: `backend/migrations/001_init.sql` → `005_mentor_student_erp.sql` (see [Database Migrations](#database-migrations)).

---

## Project Structure

```
campus-iq-2.O/
├── README.md                 # ← you are here (root)
├── LICENSE                   # MIT
├── render.yaml               # Render deploy config (backend)
├── ppt.pdf / pres.pptx       # Viva presentation
├── ppt_images/               # Slide exports
│
├── backend/                  # FastAPI — see backend/README.md
│   ├── main.py               # App entry, CORS, router mount
│   ├── config.py             # Env / settings
│   ├── dependencies.py       # get_current_user, role guards
│   ├── requirements.txt
│   ├── models/
│   │   ├── auth.py           # Pydantic schemas (signup/login)
│   │   ├── risk_predictor.pkl
│   │   └── phi3-mini.gguf    # Downloaded on first run (~3.8GB, gitignored)
│   ├── routers/              # auth, erp, resume, chat, predict, schedule, intervention
│   ├── services/             # erp_psit, resume_scorer, rag_pipeline, risk_predictor, predict_service, scheduler, local_llm, jwt/supabase
│   ├── migrations/           # 001_init → 005_mentor_student_erp
│   └── scripts/              # download_model, seed_demo, test_e2e, run_interventions
│
├── frontend/                 # React (Vite) — see frontend/README.md
│   ├── index.html
│   ├── vite.config.js
│   ├── vercel.json
│   ├── src/
│   │   ├── App.jsx           # Routes + ProtectedRoute
│   │   ├── main.jsx / index.css / App.css
│   │   ├── api/              # auth, erp, resume, chat, predict, schedule, intervention, client
│   │   ├── context/          # AuthContext (JWT, user, dashboardPath)
│   │   ├── components/       # Navbar, Sidebar, AppLayout, ErpConnectModal, RiskTable, ScheduleView, ...
│   │   ├── pages/            # Login, Signup, StudentDashboard, MentorDashboard, StudentDetail, ResumeScanner, StudyAssistant, MySchedule, StudentInterventions, Profile
│   │   └── utils/            # risk.js (labels, colors, formatters)
│   └── dist/                 # Build output (gitignored)
│
├── ml/                       # ML pipelines — see ml/README.md
│   ├── predictor/            # XGBoost risk model (train / evaluate / SHAP / synthetic data)
│   ├── resume_matching/      # Sentence-Transformers + spaCy eval
│   ├── rag_eval/             # Anti-hallucination RAG guardrail eval
│   └── venv/                 # Local ML venv (gitignored)
│
└── docs/                     # Extended notes (optional)
```

> Detailed per-folder docs: [`backend/README.md`](backend/README.md) · [`frontend/README.md`](frontend/README.md) · [`ml/README.md`](ml/README.md)

---

## Quick Start

### Prerequisites

- **Node.js** 18+ and **Python** 3.10
- **Supabase** project (URL + anon/service key)
- ~4GB free disk if running the offline LLM locally

### 1) Clone

```bash
git clone https://github.com/Aditya-dxt/Campus-IQ-2.O.git
cd Campus-IQ-2.O
```

### 2) Environment Variables

**`backend/.env`**

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-or-service-key
JWT_SECRET=your-random-jwt-secret-min-32-chars
JWT_EXPIRE_MINUTES=1440
CORS_ORIGINS=http://localhost:5173
# Optional
PORT=8000
PYTHON_VERSION=3.10.12
```

**`frontend/.env`**

```env
VITE_API_URL=http://localhost:8000
```

> Never commit `.env` — it is gitignored. Rotate keys if exposed.

### 3) Database Migrations

In **Supabase SQL Editor**, run in order:

1. `backend/migrations/001_init.sql`
2. `backend/migrations/002_student_profiles.sql`
3. `backend/migrations/003_remove_mock_defaults.sql`
4. `backend/migrations/004_erp_credentials.sql`
5. `backend/migrations/005_mentor_student_erp.sql`

### 4) Running Locally

**Backend**

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
# Health: GET http://localhost:8000/  → {"status":"ok"}
# Docs:  http://localhost:8000/docs
```

> First run downloads `phi3-mini.gguf` (~3.8GB) into `backend/models/` if missing — see `backend/scripts/download_model.py`.

**Frontend**

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## Environment Variables

| Var | Where | Required | Example |
|---|---|---|---|
| `SUPABASE_URL` | backend | yes | `https://xyz.supabase.co` |
| `SUPABASE_KEY` | backend | yes | `eyJ...` |
| `JWT_SECRET` | backend | yes | `random-32+ chars` |
| `JWT_EXPIRE_MINUTES` | backend | no | `1440` |
| `CORS_ORIGINS` | backend | no | `http://localhost:5173` or `*` (deploy) |
| `VITE_API_URL` | frontend | yes | `http://localhost:8000` |

---

## Database Migrations

| # | File | Purpose |
|---|---|---|
| 001 | `001_init.sql` | `users`, `resumes`, `risk_scores`, `interventions`, `chat_feedback` |
| 002 | `002_student_profiles.sql` | `student_profiles` (attendance, marks, resume_score, year/section) |
| 003 | `003_remove_mock_defaults.sql` | Remove mock defaults — real ERP/ML data only |
| 004 | `004_erp_credentials.sql` | `erp_id`, `erp_password_enc` on `users` |
| 005 | `005_mentor_student_erp.sql` | `coordinator_section` on users, year/section on profiles, RLS cohort isolation |

---

## API Reference

All endpoints except `/` and `/auth/*` require `Authorization: Bearer <JWT>`.

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/` | Health check → `{"status":"ok"}` | Public |
| POST | `/auth/signup` | Register (student needs `erp_id`+`erp_password`, mentor needs `coordinator_section`) | Public |
| POST | `/auth/login` | Login → `{ access_token, user }` | Public |
| GET | `/auth/me` | Current profile | Any JWT |
| GET | `/erp/status` | ERP link status | Any JWT |
| POST | `/erp/connect` | One-time ERP scrape → sync attendance/marks/year/section | Student |
| POST | `/erp/refresh` | Re-sync using stored ERP credentials | Student |
| GET | `/erp/profile` | Current ERP-linked attendance & marks | Student |
| POST | `/resume/score` | Score PDF/DOCX vs Job Description (FormData) | Any JWT |
| POST | `/chat/ingest` | Upload PDF/DOCX to Chroma | Any JWT |
| POST | `/chat/ask` | RAG query (Phi-3-mini, grounded) | Any JWT |
| GET | `/predict/dashboard` | Student risk summary + breakdown | Student |
| GET | `/predict/cohort` | Cohort risk distribution | Mentor |
| POST | `/schedule/generate` | Generate weekly plan (deadlines + risk) | Any JWT |
| POST | `/intervention/create` | Log intervention (snapshots `risk_before`) | Mentor |
| POST | `/intervention/{id}/review` | Review → re-evaluate `risk_after` + delta | Mentor |
| GET | `/intervention/student/{id}` | List interventions for a student | Mentor / Student (own) |

Full interactive docs: `http://localhost:8000/docs` (Swagger) and `/redoc`.

---

## Roles & Access Control

```mermaid
graph LR
    A[Anonymous] -->|POST /auth/signup, /auth/login| B[Authenticated]
    B -->|role=student| S[Student]
    B -->|role=mentor| M[Mentor]
    S --> S1[Dashboard, Resume, RAG Chat, Schedule, Interventions (own), Profile, ERP sync]
    M --> M1[Cohort Overview, Student Detail, Log/Review Interventions, Profile]
    S -.->|cannot| M1
    M -.->|cohort isolated| S1
```

- **Student** — own dashboard, resume ATS, RAG chat, schedule (check-off progress), intervention history, ERP connect/refresh. Cannot see cohort.
- **Mentor** — cohort overview (filtered by `coordinator_section` → strict isolation, e.g. `CS-III-M` sees only `CS-III-M` students), student detail + SHAP, log/review interventions. Cannot see other cohorts.
- Guards: `dependencies.get_current_user()` + role checks in every router; Supabase RLS mirrors the same policy.

---

## Core Features Deep Dive

### 1) Resume Scoring

Upload PDF/DOCX + paste Job Description → **ATS score 0–100** with keyword gaps and suggestions.

```mermaid
flowchart LR
    A[PDF/DOCX Upload] --> B[Text Extract<br/>PyMuPDF / python-docx]
    B --> C[sentence-transformers<br/>Embeddings]
    B --> D[spaCy<br/>Keyword Extract]
    C --> E[Cosine Similarity vs JD]
    D --> E
    E --> F[Weighted Score 0-100<br/>+ gaps & tips]
```

### 2) RAG Study Assistant (Offline)

Upload notes/syllabus → Chroma ingest → ask questions → **grounded answer or "not in documents"** (no hallucination).

```mermaid
sequenceDiagram
    participant U as Student
    participant FE as Frontend
    participant BE as FastAPI
    participant CH as Chroma
    participant LLM as Phi-3-mini (GGUF)

    U->>FE: Upload PDF
    FE->>BE: POST /chat/ingest (file)
    BE->>CH: chunk + embed + store
    U->>FE: Ask: "Explain BCS-501 Unit 3"
    FE->>BE: POST /chat/ask { query }
    BE->>CH: similarity search (top-k)
    CH-->>BE: relevant chunks
    BE->>LLM: prompt = chunks + query + guardrail
    LLM-->>BE: grounded answer
    BE-->>FE: answer + sources
```

Guardrail: if no chunk relevance > threshold, response is *"Not found in your uploaded documents."*

### 3) Risk Predictor + SHAP Explainability

```mermaid
flowchart TB
    A[Inputs<br/>attendance_pct, past_marks, resume_score] --> B[Feature Vector<br/>normalized 0-1]
    B --> C[XGBoost<br/>risk_predictor.pkl]
    C --> D[Placement Readiness 0-1<br/>0.40*marks + 0.30*attendance + 0.30*resume]
    D --> E[Academic Risk = 1 - readiness]
    E --> F[SHAP-style Breakdown<br/>per-factor contribution + weakest link]
    F --> G[Student Detail Bars<br/>Attendance 93% · Marks 77% · Resume 98%]
```

Breakdown is computed in `services/predict_service.py` from `services/risk_predictor.py` weights — displayed as 3 horizontal bars (StudentDetail) with `weakest link` callout.

### 4) Smart Scheduler

Input: deadlines, weak subjects (≤60%), risk, available hours → **weekly calendar** (Mon–Sun, evening blocks) with priority badges (`Weak · 60/100`, `Important · Due in 2d`, `To-do`).

- **Check-off progress**: each block has a checkbox → `localStorage` (`schedule_completed_<userId>`) + `schedule-completed-updated` event → **Weekly Progress ring** on Student Dashboard (real `done/total`, not mock). Regenerating resets ticks; progress persists across refresh.
- No mock data — header states *"All blocks come from your real inputs"*.

### 5) Mentor Intervention Loop (Closed-Loop)

```mermaid
sequenceDiagram
    participant M as Mentor
    participant BE as FastAPI
    participant DB as Supabase

    M->>BE: POST /intervention/create { student_id, type, notes, review_date }
    BE->>DB: snapshot risk_before (current academic_risk)
    BE->>DB: insert intervention (status=pending)
    Note over M,DB: ... time passes, student acts ...
    M->>BE: POST /intervention/{id}/review
    BE->>DB: re-evaluate risk_after (live placement/risk)
    BE->>DB: delta = risk_after - risk_before, status=reviewed
    BE-->>M: banner "Risk changed by -0.1650 (improved)" + history Before→After
```

Demo proof: `28% before → 12% after · 17% ↓ improved` with `review 14 days` and counseling notes — visible on `StudentDetail` intervention history.

---

## ML Pipelines

See [`ml/README.md`](ml/README.md) for full commands. Summary:

| Pipeline | Path | Purpose |
|---|---|---|
| **Risk Predictor** | `ml/predictor/` | XGBoost training on `students.csv` + Kaggle base, `train.py` → `risk_predictor.pkl`, `evaluate.py`, `shap_analysis.py` |
| **Resume Matching** | `ml/resume_matching/` | Sentence-Transformers + spaCy eval on `Resume.csv` |
| **RAG Eval** | `ml/rag_eval/` | Anti-hallucination guardrail tests (`test_rag.py`) |

```bash
# Example — train risk model
cd ml/predictor
pip install -r ../requirements.txt  # or ml/venv
python train.py
python evaluate.py
python shap_analysis.py
```

---

## Deployment

### Backend — Render

- Connect repo, **Root Directory: `backend`**
- Build: `pip install -r requirements.txt` · Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Env: `SUPABASE_URL`, `SUPABASE_KEY`, `JWT_SECRET`, `CORS_ORIGINS=*`
- ⚠️ Use **≥4GB RAM** instance — 512MB free tier OOMs on `phi3-mini.gguf` (3.8GB). `render.yaml` is included.

### Frontend — Vercel

- Import repo, **Root Directory: `frontend`**
- Build: `npm run build` · Output: `dist`
- Env: `VITE_API_URL=https://your-backend.onrender.com`
- `vercel.json` handles SPA fallback.

### Health Checks

```bash
curl http://localhost:8000/      # → {"status":"ok"}
curl http://localhost:8000/docs  # Swagger
curl http://localhost:5173/      # Vite dev
```

---

## Screenshots

> Add real captures to `docs/screenshots/` and link here for viva.

| Page | Capture |
|---|---|
| Login | `docs/screenshots/login.png` |
| Student Dashboard (7 cards + weekly ring) | `docs/screenshots/student-dashboard.png` |
| Marks by Test (ERP) | `docs/screenshots/marks-by-test.png` |
| Schedule — check-off + progress | `docs/screenshots/schedule.png` |
| Student Detail — SHAP + Intervention delta | `docs/screenshots/student-detail.png` |
| Mentor Cohort Overview | `docs/screenshots/mentor-cohort.png` |

---

## Roadmap

- [ ] Push notifications (risk alerts, review due)
- [ ] Export schedule to calendar (.ics)
- [ ] Multi-ERP adapters (CSV import fallback)
- [ ] Cohort analytics — trends, at-risk heatmap (Recharts)
- [ ] E2E Playwright tests + CI

---

## Contributing

```bash
# Branch + PR workflow
git checkout -b feat/your-feature
# ... code + test ...
npm run build    # frontend
python -m py_compile backend/main.py
git commit -m "feat: describe change"
git push origin feat/your-feature
# Open PR to main
```

Please run `npm run build` (frontend) and `python scripts/test_e2e.py` (backend) before PR.

---

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 CampusIQ.

---

<p align="center"><sub>Built with FastAPI · React · Supabase · Chroma · Phi-3-mini · XGBoost · SHAP</sub></p>
