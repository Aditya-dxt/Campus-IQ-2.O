import os
import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()  # Load .env BEFORE any router/service imports read env vars

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import auth, chat, intervention, predict, resume, schedule

# Add automatic model download check on startup
models_dir = Path(__file__).resolve().parent / "models"
model_file = models_dir / "phi3-mini.gguf"

if not model_file.exists() or model_file.stat().st_size < 1024**3:
    print("Local LLM model not found or invalid. Auto-downloading...")
    # Import and run the download script
    scripts_dir = Path(__file__).resolve().parent / "scripts"
    sys.path.insert(0, str(scripts_dir))
    import download_model
    download_model.download_model()
    sys.path.pop(0)

app = FastAPI(title="CampusIQ API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_origin_regex=r"https://.*\.vercel\.app|https://.*\.ngrok-free\.dev",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(resume.router)
app.include_router(chat.router)
app.include_router(predict.router)
app.include_router(schedule.router)
app.include_router(intervention.router)


@app.get("/")
def health_check():
    return {"status": "ok"}
