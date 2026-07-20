"""Resume Router — Score a resume against a Job Description.

Accepts resume and JD text, calls the resume_scorer service,
logs the result to the Supabase `resumes` table.
"""
import tempfile
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from pydantic import BaseModel

from dependencies import CurrentUser, get_current_user
from services.resume_scorer import score_resume, extract_text
from services.supabase_client import get_supabase_client

router = APIRouter(prefix="/resume", tags=["resume"])


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------

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
            "POST /resume/score  — Score resume file against a JD",
            "GET  /resume/history — View past resume scores (student only)",
        ],
    }


@router.post(
    "/score",
    response_model=ResumeScoreResponse,
    status_code=status.HTTP_200_OK,
)
async def score_resume_endpoint(
    file: UploadFile = File(...),
    job_description: str = Form(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Score a student's resume against a Job Description.

    - Extracts text from PDF/DOCX/TXT
    - Computes semantic similarity + keyword diff via the resume_scorer service.
    - Logs the result to the Supabase `resumes` table.
    """
    if not job_description or len(job_description) < 20:
         raise HTTPException(status_code=400, detail="Job description must be at least 20 characters.")
    
    # Save file to temp path to extract text
    ext = Path(file.filename or "").suffix.lower()
    temp_path = Path(tempfile.gettempdir()) / f"{current_user['sub']}_resume{ext}"
    try:
        contents = await file.read()
        with open(temp_path, "wb") as f:
            f.write(contents)
            
        resume_text = extract_text(str(temp_path))
    finally:
        if temp_path.exists():
            temp_path.unlink()
            
    if not resume_text or len(resume_text) < 50:
         raise HTTPException(status_code=400, detail="Could not extract enough text from the resume file.")

    # Call the ML service
    result = score_resume(resume_text, job_description)

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
