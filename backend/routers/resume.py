"""Resume Router — Score a resume against a Job Description.

Accepts resume and JD text, calls the resume_scorer service,
logs the result to the Supabase `resumes` table.
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from dependencies import CurrentUser
from services.resume_scorer import score_resume
from services.supabase_client import get_supabase_client

router = APIRouter(prefix="/resume", tags=["resume"])


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------

class ResumeScoreRequest(BaseModel):
    """Request body for resume scoring."""
    resume_text: str = Field(
        ..., min_length=50, max_length=50000,
        description="Plain text of the student's resume (min 50 chars)."
    )
    jd_text: str = Field(
        ..., min_length=20, max_length=50000,
        description="Plain text of the Job Description to compare against."
    )


class ResumeScoreResponse(BaseModel):
    """Structured response from the resume scorer."""
    score: float
    base_semantic_score: float
    missing_keywords: list[str]
    suggestions: list[str]
    saved: bool = False


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/")
def resume_root():
    """Health check for the resume module."""
    return {
        "status": "ok",
        "endpoints": [
            "POST /resume/score  — Score resume text against a JD",
            "GET  /resume/history — View past resume scores (student only)",
        ],
    }


@router.post(
    "/score",
    response_model=ResumeScoreResponse,
    status_code=status.HTTP_200_OK,
)
def score_resume_endpoint(body: ResumeScoreRequest, current_user: CurrentUser):
    """
    Score a student's resume against a Job Description.

    - Computes semantic similarity + keyword diff via the resume_scorer service.
    - Logs the result to the Supabase `resumes` table.
    """
    # Call the ML service
    result = score_resume(body.resume_text, body.jd_text)

    # Persist to Supabase
    saved = False
    try:
        supabase = get_supabase_client()
        supabase.table("resumes").insert({
            "user_id": current_user["sub"],
            "score": result["score"],
            "missing_keywords": result["missing_keywords"],
            "suggestions": result["suggestions"],
        }).execute()
        saved = True
    except Exception as exc:
        # Log but don't fail the request — the score itself is still valid
        print(f"Warning: failed to persist resume score to DB: {exc}")

    return ResumeScoreResponse(
        score=result["score"],
        base_semantic_score=result["base_semantic_score"],
        missing_keywords=result["missing_keywords"],
        suggestions=result["suggestions"],
        saved=saved,
    )


@router.get("/history")
def resume_history(current_user: CurrentUser):
    """
    Return all past resume scores for the logged-in student,
    ordered newest-first.
    """
    try:
        supabase = get_supabase_client()
        response = (
            supabase.table("resumes")
            .select("id, score, missing_keywords, suggestions, created_at")
            .eq("user_id", current_user["sub"])
            .order("created_at", desc=True)
            .execute()
        )
        return {"history": response.data or []}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch resume history: {exc}",
        ) from exc
