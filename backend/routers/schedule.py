"""Schedule Router — Smart Scheduler endpoints.

Accepts student academic data and generates a weekly study plan
using the rule-based scheduler service.
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from dependencies import CurrentUser
from services.scheduler import generate_study_plan

router = APIRouter(prefix="/schedule", tags=["schedule"])


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------

class DeadlineItem(BaseModel):
    """A single upcoming deadline."""
    subject: str = Field(..., min_length=1, description="Subject name.")
    task: str = Field(default="Assignment", description="Task description.")
    days_until_due: int = Field(..., ge=1, le=365, description="Days until due.")


class ScheduleRequest(BaseModel):
    """Request body for generating a study plan."""
    weak_subjects: dict[str, float] = Field(
        ...,
        description="Map of subject name → current score (0-100). E.g. {'Math': 45, 'CS': 85}",
    )
    deadlines: list[DeadlineItem] = Field(
        default=[],
        description="List of upcoming deadlines.",
    )
    available_hours: dict[str, int] = Field(
        ...,
        description="Map of day name → available study hours. E.g. {'Monday': 2, 'Tuesday': 3}",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/")
def schedule_root():
    """Health check for the schedule module."""
    return {
        "status": "ok",
        "endpoints": [
            "POST /schedule/generate — Generate a weekly study plan",
        ],
    }


@router.post("/generate", status_code=status.HTTP_200_OK)
def generate_schedule(body: ScheduleRequest, current_user: CurrentUser):
    """
    Generate a personalised weekly study plan.

    - Prioritises subjects with lowest scores and nearest deadlines.
    - Distributes study blocks across the student's available time slots.
    - Uses diminishing-returns logic to ensure subject variety.
    """
    # Validate that at least some hours are available
    total_hours = sum(body.available_hours.values())
    if total_hours == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="You must have at least 1 available study hour in your week.",
        )

    # Validate subject scores are in range
    for subject, score in body.weak_subjects.items():
        if not (0 <= score <= 100):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Score for '{subject}' must be between 0 and 100, got {score}.",
            )

    # Convert deadline models to dicts for the service
    deadlines_raw = [dl.model_dump() for dl in body.deadlines]

    # Call the scheduler service
    try:
        plan = generate_study_plan(
            weak_subjects=body.weak_subjects,
            deadlines=deadlines_raw,
            available_hours=body.available_hours,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scheduler error: {exc}",
        ) from exc

    return {
        "student_id": current_user["sub"],
        "total_study_hours": total_hours,
        "plan": plan,
    }
