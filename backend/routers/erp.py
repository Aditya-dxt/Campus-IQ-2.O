"""ERP router — connect PSIT ERP and sync real attendance + marks into student_profiles."""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from dependencies import CurrentUser
from services.supabase_client import get_supabase_client
from services.erp_psit import scrape_psit_erp

router = APIRouter(prefix="/erp", tags=["erp"])


class ErpConnectRequest(BaseModel):
    erp_id: str = Field(..., min_length=3, description="PSIT ERP User ID / Roll Number, e.g. 2401640100073")
    password: str = Field(..., min_length=1, description="PSIT ERP password")


@router.get("/")
def erp_root():
    return {"status": "ok", "endpoints": ["POST /erp/connect — scrape PSIT ERP and update profile (attendance + marks)", "GET /erp/profile — get current ERP-linked attendance & marks"]}


@router.post("/connect", status_code=status.HTTP_200_OK)
def erp_connect(body: ErpConnectRequest, current_user: CurrentUser):
    """
    Log into PSIT ERP, scrape attendance + subject marks,
    and update student_profiles.attendance_pct / past_marks.
    Credentials are NOT stored — one-time scrape.
    Low marks automatically become high-priority subjects for the scheduler.
    """
    if current_user.get("role") != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students can connect ERP.")

    user_id = current_user["sub"]

    try:
        data = scrape_psit_erp(body.erp_id, body.password)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve)) from ve
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"ERP scrape failed: {e}") from e

    attendance_pct = float(data["attendance_pct"])
    avg_marks = data.get("avg_marks_percent")

    # Update student_profiles with real attendance + marks
    try:
        supabase = get_supabase_client()
        payload: dict = {"user_id": user_id, "attendance_pct": attendance_pct}
        if avg_marks is not None:
            payload["past_marks"] = float(avg_marks)
        supabase.table("student_profiles").upsert(payload, on_conflict="user_id").execute()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to save ERP data to profile: {e}") from e

    return {
        "message": "PSIT ERP connected — attendance and marks synced." if avg_marks is not None else "PSIT ERP connected — attendance synced (no marks found yet — select CT-1/ASG-1 in ERP after exams).",
        "erp_id": data["erp_id"],
        "attendance": {
            "attendance_pct": attendance_pct,
            "with_pf_pct": data.get("with_pf_pct"),
            "without_pf_pct": data.get("without_pf_pct"),
            "tl": data.get("tl"),
            "present": data.get("present"),
            "pf": data.get("pf"),
            "absent": data.get("absent"),
            "section": data.get("section"),
        },
        "marks": {
            "subjects": data.get("marks", []),
            "avg_percent": avg_marks,
        },
        "scraped_at": data.get("scraped_at"),
        "note": "Credentials were not stored — re-enter to sync again after ERP updates. Low-scoring subjects will be prioritized when you generate your schedule.",
    }


@router.get("/profile", status_code=status.HTTP_200_OK)
def erp_profile(current_user: CurrentUser):
    """Return current ERP-synced attendance + marks from student_profiles."""
    if current_user.get("role") != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students.")
    try:
        supabase = get_supabase_client()
        res = supabase.table("student_profiles").select("attendance_pct, past_marks, submission_rate, updated_at").eq("user_id", current_user["sub"]).limit(1).execute()
        if not res.data:
            return {"attendance_pct": None, "past_marks": None, "message": "No ERP data yet — use POST /erp/connect with your PSIT credentials."}
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)) from e


@router.get("/marks", status_code=status.HTTP_200_OK)
def erp_marks_preview(current_user: CurrentUser):
    """
    Return subject-wise marks preview for the scheduler.
    Uses the latest past_marks avg + reconstructs per-subject weak list from stored data.
    For full per-subject breakdown, re-run POST /erp/connect.
    """
    if current_user.get("role") != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students.")
    try:
        supabase = get_supabase_client()
        res = supabase.table("student_profiles").select("past_marks, attendance_pct, updated_at").eq("user_id", current_user["sub"]).limit(1).execute()
        if not res.data:
            return {"past_marks": None, "subjects": []}
        return {"past_marks": res.data[0].get("past_marks"), "attendance_pct": res.data[0].get("attendance_pct"), "updated_at": res.data[0].get("updated_at")}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)) from e
