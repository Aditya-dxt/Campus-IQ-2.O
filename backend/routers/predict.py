from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from dependencies import CurrentUser, RequireMentor
from services import predict_service
from services.risk_predictor import FEATURE_NAMES, model_available, predict_risk

router = APIRouter(prefix="/predict", tags=["predict"])


class ScoreRequest(BaseModel):
    attendance_pct: float = Field(ge=0, le=100)
    past_marks: float = Field(ge=0, le=100)
    submission_rate: float = Field(ge=0, le=1)
    login_frequency: int = Field(ge=0)
    resume_scans_count: int = Field(ge=0)
    mock_interview_score: float = Field(ge=0, le=100)
    career_chat_activity_count: int = Field(ge=0)


def _ensure_model() -> None:
    if not model_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Risk model not trained. Run ml/predictor/train.py first.",
        )


@router.get("/")
def predict_root():
    return {
        "status": "ok",
        "model_loaded": model_available(),
        "endpoints": [
            "/predict/dashboard",
            "/predict/students",
            "/predict/students/{student_id}",
            "/predict/cohort",
            "/predict/score",
        ],
    }


@router.get("/dashboard")
def student_dashboard(current_user: CurrentUser):
    _ensure_model()
    if current_user.get("role") != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student dashboard is only available to student accounts",
        )
    return predict_service.student_dashboard(current_user["sub"])


@router.get("/students")
def list_students(_mentor: RequireMentor):
    _ensure_model()
    return predict_service.list_students()


@router.get("/students/{student_id}")
def get_student(student_id: str, _mentor: RequireMentor):
    _ensure_model()
    student = predict_service.get_student(student_id)
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return student


@router.get("/cohort")
def cohort_stats(_mentor: RequireMentor):
    _ensure_model()
    return predict_service.cohort_stats()


@router.post("/score")
def score_features(body: ScoreRequest, current_user: CurrentUser):
    _ensure_model()
    features = body.model_dump()
    result = predict_risk(features)

    # Persist the prediction to the risk_scores table
    saved = False
    try:
        from services.supabase_client import get_supabase_client
        supabase = get_supabase_client()
        supabase.table("risk_scores").insert({
            "user_id": current_user["sub"],
            "academic_risk": result["academic_risk"],
            "placement_readiness": result["placement_readiness"],
            "top_factor": result.get("top_factor"),
        }).execute()
        saved = True
    except Exception as exc:
        print(f"Warning: failed to persist risk score to DB: {exc}")

    return {
        "features": features,
        "prediction": result,
        "requested_by": current_user["sub"],
        "role": current_user.get("role"),
        "saved_to_db": saved,
    }

