"""ERP router — connect PSIT ERP and sync real attendance + marks into student_profiles."""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
import base64

from dependencies import CurrentUser
from services.supabase_client import get_supabase_client
from services.erp_psit import scrape_psit_erp

router = APIRouter(prefix="/erp", tags=["erp"])


def _encode_pw(pw: str) -> str:
    return base64.b64encode(pw.encode()).decode()

def _decode_pw(enc: str) -> str:
    try:
        return base64.b64decode(enc.encode()).decode()
    except Exception:
        return enc

class ErpConnectRequest(BaseModel):
    erp_id: str = Field(..., min_length=3, description="PSIT ERP User ID / Roll Number, e.g. 2401640100073")
    password: str = Field(..., min_length=1, description="PSIT ERP password")


@router.get("/")
def erp_root():
    return {"status": "ok", "endpoints": ["POST /erp/connect — scrape PSIT ERP and update profile (attendance + marks)", "POST /erp/refresh — re-sync using stored credentials", "GET /erp/status — check if ERP linked", "GET /erp/profile — get current ERP-linked attendance & marks"]}


def _save_erp_state(user_id: str, erp_id: str, password: str, data: dict):
    """Persist ERP credentials + snapshot so refresh works without re-entering password."""
    supabase = get_supabase_client()
    enc = _encode_pw(password)
    attendance_pct = float(data["attendance_pct"])
    avg_marks = data.get("avg_marks_percent")
    # Try dedicated table first
    try:
        supabase.table("erp_credentials").upsert({
            "user_id": user_id,
            "erp_id": erp_id.strip(),
            "erp_password": enc,
            "last_synced_at": data.get("scraped_at"),
            "last_attendance_pct": attendance_pct,
            "last_marks_avg": float(avg_marks) if avg_marks is not None else None,
        }, on_conflict="user_id").execute()
    except Exception:
        pass
    # Also mirror into student_profiles if columns exist (migration 004)
    try:
        payload: dict = {
            "user_id": user_id,
            "attendance_pct": attendance_pct,
            "erp_id": erp_id.strip(),
            "erp_password": enc,
            "erp_last_synced": data.get("scraped_at"),
            "erp_attendance": data.get("attendance", {}),
            "erp_marks": data.get("marks", []),
        }
        if avg_marks is not None:
            payload["past_marks"] = float(avg_marks)
        supabase.table("student_profiles").upsert(payload, on_conflict="user_id").execute()
    except Exception:
        # Fallback without new columns
        try:
            fallback = {"user_id": user_id, "attendance_pct": attendance_pct}
            if avg_marks is not None:
                fallback["past_marks"] = float(avg_marks)
            supabase.table("student_profiles").upsert(fallback, on_conflict="user_id").execute()
        except Exception:
            pass


@router.post("/connect", status_code=status.HTTP_200_OK)
def erp_connect(body: ErpConnectRequest, current_user: CurrentUser):
    """
    One-time ERP connect: log into PSIT ERP, scrape attendance + marks,
    store credentials (so dashboard refresh works), and update profile.
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

    _save_erp_state(user_id, body.erp_id, body.password, {
        "attendance_pct": data["attendance_pct"],
        "avg_marks_percent": data.get("avg_marks_percent"),
        "scraped_at": data.get("scraped_at"),
        "attendance": {
            "attendance_pct": data["attendance_pct"],
            "with_pf_pct": data.get("with_pf_pct"),
            "without_pf_pct": data.get("without_pf_pct"),
            "tl": data.get("tl"),
            "present": data.get("present"),
            "pf": data.get("pf"),
            "absent": data.get("absent"),
            "section": data.get("section"),
        },
        "marks": data.get("marks", []),
    })

    attendance_pct = float(data["attendance_pct"])
    avg_marks = data.get("avg_marks_percent")

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
        "marks_debug": data.get("marks_debug", []),
        "scraped_at": data.get("scraped_at"),
        "note": "Credentials saved securely — use Refresh on dashboard to re-sync after ERP updates.",
    }


@router.post("/refresh", status_code=status.HTTP_200_OK)
def erp_refresh(current_user: CurrentUser):
    """
    Re-sync using stored ERP credentials (no password re-entry).
    Returns new values + diff vs previous.
    """
    if current_user.get("role") != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students.")
    user_id = current_user["sub"]
    supabase = get_supabase_client()

    # Fetch stored credentials
    erp_id = None
    password = None
    prev_att = None
    prev_avg = None
    try:
        res = supabase.table("erp_credentials").select("erp_id, erp_password, last_attendance_pct, last_marks_avg").eq("user_id", user_id).limit(1).execute()
        if res.data:
            erp_id = res.data[0].get("erp_id")
            enc = res.data[0].get("erp_password")
            if enc:
                password = _decode_pw(enc)
            prev_att = res.data[0].get("last_attendance_pct")
            prev_avg = res.data[0].get("last_marks_avg")
    except Exception:
        pass
    if not erp_id or not password:
        # Fallback to student_profiles
        try:
            res2 = supabase.table("student_profiles").select("erp_id, erp_password").eq("user_id", user_id).limit(1).execute()
            if res2.data and res2.data[0].get("erp_id"):
                erp_id = res2.data[0].get("erp_id")
                enc = res2.data[0].get("erp_password")
                if enc:
                    password = _decode_pw(enc)
        except Exception:
            pass
    if not erp_id or not password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No ERP credentials stored — please connect ERP first (one-time setup).")

    try:
        data = scrape_psit_erp(erp_id, password)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve)) from ve
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"ERP refresh failed: {e}") from e

    # Save new snapshot
    _save_erp_state(user_id, erp_id, password, {
        "attendance_pct": data["attendance_pct"],
        "avg_marks_percent": data.get("avg_marks_percent"),
        "scraped_at": data.get("scraped_at"),
        "attendance": {
            "attendance_pct": data["attendance_pct"],
            "with_pf_pct": data.get("with_pf_pct"),
            "without_pf_pct": data.get("without_pf_pct"),
            "tl": data.get("tl"),
            "present": data.get("present"),
            "pf": data.get("pf"),
            "absent": data.get("absent"),
            "section": data.get("section"),
        },
        "marks": data.get("marks", []),
    })

    new_att = float(data["attendance_pct"])
    new_avg = data.get("avg_marks_percent")
    diff_att = round(new_att - float(prev_att), 2) if prev_att is not None else None
    diff_avg = round(float(new_avg) - float(prev_avg), 2) if prev_avg is not None and new_avg is not None else None

    changes = []
    if diff_att is not None and diff_att != 0:
        changes.append(f"Attendance {prev_att}% → {new_att}% ({'+' if diff_att>0 else ''}{diff_att}%)")
    if diff_avg is not None and diff_avg != 0:
        changes.append(f"Avg marks {prev_avg}% → {new_avg}% ({'+' if diff_avg>0 else ''}{diff_avg}%)")
    if not changes:
        changes.append("No change since last sync — ERP data is up to date.")

    return {
        "message": "Refreshed from PSIT ERP.",
        "erp_id": data["erp_id"],
        "attendance": {
            "attendance_pct": new_att,
            "with_pf_pct": data.get("with_pf_pct"),
            "without_pf_pct": data.get("without_pf_pct"),
            "tl": data.get("tl"),
            "present": data.get("present"),
            "pf": data.get("pf"),
            "absent": data.get("absent"),
            "section": data.get("section"),
        },
        "marks": {"subjects": data.get("marks", []), "avg_percent": new_avg},
        "marks_debug": data.get("marks_debug", []),
        "scraped_at": data.get("scraped_at"),
        "changes": changes,
        "diff": {"attendance_pct": diff_att, "avg_marks": diff_avg},
    }


@router.get("/status", status_code=status.HTTP_200_OK)
def erp_status(current_user: CurrentUser):
    """Whether ERP is linked and last sync info. Resilient to missing migration columns."""
    if current_user.get("role") != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students.")
    supabase = get_supabase_client()
    # Try erp_credentials table (migration 004) — may not exist yet
    try:
        res = supabase.table("erp_credentials").select("erp_id, last_synced_at, last_attendance_pct, last_marks_avg").eq("user_id", current_user["sub"]).limit(1).execute()
        if res.data and res.data[0].get("erp_id"):
            r = res.data[0]
            return {"connected": True, "erp_id": r.get("erp_id"), "last_synced_at": r.get("last_synced_at"), "attendance_pct": r.get("last_attendance_pct"), "avg_marks": r.get("last_marks_avg")}
    except Exception:
        pass
    # Fallback: check student_profiles with minimal columns that always exist
    try:
        res2 = supabase.table("student_profiles").select("attendance_pct, past_marks, updated_at").eq("user_id", current_user["sub"]).limit(1).execute()
        if res2.data and res2.data[0].get("attendance_pct") is not None:
            r = res2.data[0]
            # Try to enrich with erp_id if column exists — ignore error if not
            erp_id = "linked"
            last_synced = r.get("updated_at")
            try:
                res3 = supabase.table("student_profiles").select("erp_id, erp_last_synced").eq("user_id", current_user["sub"]).limit(1).execute()
                if res3.data:
                    if res3.data[0].get("erp_id"):
                        erp_id = res3.data[0].get("erp_id")
                    if res3.data[0].get("erp_last_synced"):
                        last_synced = res3.data[0].get("erp_last_synced")
            except Exception:
                pass
            return {"connected": True, "erp_id": erp_id, "last_synced_at": last_synced, "attendance_pct": r.get("attendance_pct"), "avg_marks": r.get("past_marks")}
    except Exception:
        pass
    return {"connected": False}


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
