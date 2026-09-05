"""Intervention Router — Mentor feedback-loop endpoints.

Mentors can create interventions for at-risk students and the system
snapshots the student's risk score before/after the intervention period.
"""
from datetime import date, datetime

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from dependencies import CurrentUser, RequireMentor
from services.supabase_client import get_supabase_client

router = APIRouter(prefix="/intervention", tags=["intervention"])


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------

class CreateInterventionRequest(BaseModel):
    """Body for creating a new intervention."""
    student_id: str = Field(..., min_length=1, description="UUID of the target student.")
    action_note: str = Field(
        ..., min_length=5, max_length=2000,
        description="Description of the intervention action taken by the mentor.",
    )
    review_date: date = Field(
        ...,
        description="The date on which risk_after should be re-evaluated (YYYY-MM-DD).",
    )


class ReviewInterventionRequest(BaseModel):
    """Body for manually triggering a review of an intervention."""
    intervention_id: str = Field(..., min_length=1, description="UUID of the intervention to review.")


# ---------------------------------------------------------------------------
# Helpers — FIXED: compute risk from live student_profiles via predictor
# ---------------------------------------------------------------------------

def _get_latest_risk(student_id: str) -> float | None:
    """Compute current academic_risk from student_profiles via new placement formula."""
    try:
        from services.supabase_client import get_supabase_client
        from services.risk_predictor import predict_risk

        supabase = get_supabase_client()
        prof = supabase.table("student_profiles").select("attendance_pct, past_marks, mock_interview_score, resume_scans_count, submission_rate, login_frequency, career_chat_activity_count, updated_at").eq("user_id", student_id).limit(1).execute()
        if not prof.data:
            return None
        profile = prof.data[0]
        # resolve resume_score live (same as predict_service)
        resume_score = None
        try:
            r = supabase.table("resumes").select("score").eq("user_id", student_id).order("created_at", desc=True).limit(1).execute()
            if r.data and r.data[0].get("score") is not None:
                resume_score = int(float(r.data[0]["score"]))  # type: ignore[arg-type]
        except Exception:
            pass
        if resume_score is None:
            v = profile.get("mock_interview_score")
            if v is not None:
                try:
                    resume_score = int(float(v))  # type: ignore[arg-type]
                except Exception:
                    resume_score = None
        features = dict(profile)
        if resume_score is not None and features.get("mock_interview_score") is None:
            features["mock_interview_score"] = resume_score
        result = predict_risk(features, resume_score=resume_score)
        val = result.get("academic_risk")
        return float(val) if val is not None else None  # type: ignore[arg-type]
    except Exception as exc:
        print(f"Warning: could not compute risk for {student_id}: {exc}")
        try:
            from services.supabase_client import get_supabase_client as _gsc
            supabase2 = _gsc()
            resp = supabase2.table("risk_scores").select("academic_risk").eq("user_id", student_id).order("computed_at", desc=True).limit(1).execute()
            if resp.data:
                return float(resp.data[0]["academic_risk"])  # type: ignore[arg-type]
        except Exception:
            pass
    return None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/")
def intervention_root():
    """Health check for the intervention module."""
    return {
        "status": "ok",
        "endpoints": [
            "POST /intervention/create  — Create a new intervention (mentor only)",
            "GET  /intervention/list     — List interventions for a student",
            "POST /intervention/review   — Manually trigger risk_after recomputation",
        ],
    }


@router.post("/create", status_code=status.HTTP_201_CREATED)
def create_intervention(body: CreateInterventionRequest, mentor: RequireMentor):
    """
    Create a new intervention for an at-risk student (mentor only).

    - Snapshots the student's current `academic_risk` as `risk_before` (computed live).
    - Sets `risk_after` to NULL — it will be filled at the `review_date` or via manual review.
    """
    if body.review_date <= date.today():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="review_date must be in the future.",
        )

    supabase = get_supabase_client()
    try:
        student_resp = supabase.table("users").select("id, role").eq("id", body.student_id).single().execute()
        if not student_resp.data or student_resp.data.get("role") != "student":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found or target is not a student.")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Could not verify student: {exc}") from exc

    risk_before = _get_latest_risk(body.student_id)

    try:
        insert_resp = supabase.table("interventions").insert({
            "student_id": body.student_id,
            "mentor_id": mentor["sub"],
            "action_note": body.action_note,
            "risk_before": risk_before,
            "risk_after": None,
            "review_date": body.review_date.isoformat(),
        }).execute()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create intervention: {exc}") from exc

    return {
        "intervention": insert_resp.data[0] if insert_resp.data else None,
        "risk_before": risk_before,
        "message": f"Intervention created. Risk_before={risk_before}. Risk will be re-evaluated on {body.review_date}.",
    }


@router.get("/list")
def list_interventions(student_id: str, current_user: CurrentUser):
    """
    List all interventions for a given student.
    - Mentors can view any student.
    - Students can only view their own interventions.
    """
    if current_user.get("role") == "student" and current_user["sub"] != student_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Students can only view their own interventions.")

    try:
        supabase = get_supabase_client()
        resp = supabase.table("interventions").select("*").eq("student_id", student_id).order("created_at", desc=True).execute()
        return {"interventions": resp.data or []}
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to fetch interventions: {exc}") from exc


@router.post("/review")
def review_intervention(body: ReviewInterventionRequest, mentor: RequireMentor):
    """
    Manually trigger risk_after recomputation for an intervention.
    - Fetches the student's current risk and writes it to `risk_after`.
    - Only works if `risk_after` is currently NULL.
    """
    supabase = get_supabase_client()
    try:
        resp = supabase.table("interventions").select("*").eq("id", body.intervention_id).single().execute()
        intervention = resp.data
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Intervention not found: {exc}") from exc

    if not intervention:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intervention not found.")
    if intervention.get("risk_after") is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This intervention has already been reviewed.")

    risk_after = _get_latest_risk(intervention["student_id"])
    try:
        supabase.table("interventions").update({"risk_after": risk_after}).eq("id", body.intervention_id).execute()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update intervention: {exc}") from exc

    risk_before = intervention.get("risk_before")
    delta = None
    if risk_before is not None and risk_after is not None:
        delta = round(float(risk_after) - float(risk_before), 4)

    return {
        "intervention_id": body.intervention_id,
        "risk_before": risk_before,
        "risk_after": risk_after,
        "delta": delta,
        "improved": delta is not None and delta < 0,
        "message": "Intervention reviewed successfully." + (f" Risk changed by {delta:+.4f} ({'improved' if delta and delta<0 else 'worsened' if delta and delta>0 else 'no change'})." if delta is not None else ""),
    }
