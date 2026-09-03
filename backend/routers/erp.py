"""ERP router — connect PSIT ERP and sync real attendance into student_profiles."""

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
    return {"status": "ok", "endpoints": ["POST /erp/connect — scrape PSIT ERP and update profile", "GET /erp/profile — get current ERP-linked attendance"]}


@router.post("/connect", status_code=status.HTTP_200_OK)
def erp_connect(body: ErpConnectRequest, current_user: CurrentUser):
    """
    Log into PSIT ERP with provided credentials, scrape attendance,
    and update the student's student_profiles.attendance_pct.
    Credentials are NOT stored — one-time scrape.
    """
    if current_user.get("role") != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students can connect ERP.")

    user_id = current_user["sub"]

    # Scrape ERP (may raise ValueError)
    try:
        data = scrape_psit_erp(body.erp_id, body.password)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve)) from ve
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"ERP scrape failed: {e}") from e

    attendance_pct = float(data["attendance_pct"])

    # Update student_profiles with real attendance
    try:
        supabase = get_supabase_client()
        # Upsert profile — ensure row exists
        supabase.table("student_profiles").upsert(
            {"user_id": user_id, "attendance_pct": attendance_pct}, on_conflict="user_id"
        ).execute()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to save ERP attendance to profile: {e}") from e

    return {
        "message": "PSIT ERP connected — attendance synced to your CampusIQ profile.",
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
        "scraped_at": data.get("scraped_at"),
        "note": "Credentials were not stored — re-enter to sync again after ERP updates.",
    }


@router.get("/profile", status_code=status.HTTP_200_OK)
def erp_profile(current_user: CurrentUser):
    """Return the student's current attendance from student_profiles (real ERP-synced value)."""
    if current_user.get("role") != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students.")
    try:
        supabase = get_supabase_client()
        res = supabase.table("student_profiles").select("attendance_pct, past_marks, submission_rate, updated_at").eq("user_id", current_user["sub"]).limit(1).execute()
        if not res.data:
            return {"attendance_pct": None, "message": "No ERP data yet — use POST /erp/connect with your PSIT credentials."}
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)) from e
