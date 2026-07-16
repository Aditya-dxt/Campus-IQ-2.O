from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS
from routers import auth, chat, intervention, predict, resume, schedule

app = FastAPI(title="CampusIQ API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
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
