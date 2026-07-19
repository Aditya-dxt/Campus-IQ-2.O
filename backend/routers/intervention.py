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
# Helpers
# ---------------------------------------------------------------------------

def _get_latest_risk(student_id: str) -> float | None:
    """Fetch the most recent academic_risk value for a student from the risk_scores table."""
    try:
        supabase = get_supabase_client()
        resp = (
            supabase.table("risk_scores")
            .select("academic_risk")
            .eq("user_id", student_id)
            .order("computed_at", desc=True)
            .limit(1)
            .execute()
        )
        if resp.data:
            return float(resp.data[0]["academic_risk"])
    except Exception as exc:
        print(f"Warning: could not fetch risk for student {student_id}: {exc}")
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

    - Snapshots the student's current `academic_risk` as `risk_before`.
    - Sets `risk_after` to NULL — it will be filled at the `review_date`.
    - Logs the intervention to the `interventions` table.
    """
    # Validate review_date is in the future
    if body.review_date <= date.today():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="review_date must be in the future.",
        )

    # Verify the student exists
    supabase = get_supabase_client()
    try:
        student_resp = (
            supabase.table("users")
            .select("id, role")
            .eq("id", body.student_id)
            .single()
            .execute()
        )
        if not student_resp.data or student_resp.data.get("role") != "student":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found or the target user is not a student.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Could not verify student: {exc}",
        ) from exc

    # Snapshot the current risk score
    risk_before = _get_latest_risk(body.student_id)

    # Insert the intervention
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create intervention: {exc}",
        ) from exc

    return {
        "intervention": insert_resp.data[0] if insert_resp.data else None,
        "risk_before": risk_before,
        "message": f"Intervention created. Risk will be re-evaluated on {body.review_date}.",
    }


@router.get("/list")
def list_interventions(student_id: str, current_user: CurrentUser):
    """
    List all interventions for a given student.

    - Mentors can view any student.
    - Students can only view their own interventions.
    """
    # RBAC: Students can only see their own
    if current_user.get("role") == "student" and current_user["sub"] != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students can only view their own interventions.",
        )

    try:
        supabase = get_supabase_client()
        resp = (
            supabase.table("interventions")
            .select("*")
            .eq("student_id", student_id)
            .order("created_at", desc=True)
            .execute()
        )
        return {"interventions": resp.data or []}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch interventions: {exc}",
        ) from exc


@router.post("/review")
def review_intervention(body: ReviewInterventionRequest, mentor: RequireMentor):
    """
    Manually trigger risk_after recomputation for an intervention.

    - Fetches the student's current risk score and writes it to `risk_after`.
    - Only works if `risk_after` is currently NULL.
    """
    supabase = get_supabase_client()

    # Fetch the intervention
    try:
        resp = (
            supabase.table("interventions")
            .select("*")
            .eq("id", body.intervention_id)
            .single()
            .execute()
        )
        intervention = resp.data
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Intervention not found: {exc}",
        ) from exc

    if not intervention:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Intervention not found.",
        )

    if intervention.get("risk_after") is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This intervention has already been reviewed.",
        )

    # Compute risk_after
    risk_after = _get_latest_risk(intervention["student_id"])

    # Update the record
    try:
        supabase.table("interventions").update({
            "risk_after": risk_after,
        }).eq("id", body.intervention_id).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update intervention: {exc}",
        ) from exc

    risk_before = intervention.get("risk_before")
    delta = None
    if risk_before is not None and risk_after is not None:
        delta = round(float(risk_after) - float(risk_before), 4)

    return {
        "intervention_id": body.intervention_id,
        "risk_before": risk_before,
        "risk_after": risk_after,
        "delta": delta,
        "message": "Intervention reviewed successfully." + (
            f" Risk changed by {delta:+.4f}." if delta is not None else ""
        ),
    }
