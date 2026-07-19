"""Intervention Review Cron Script

Run this script periodically (e.g. daily via cron or Windows Task Scheduler)
to automatically recompute `risk_after` for interventions whose `review_date`
has been reached.

Usage:
    python backend/scripts/run_interventions.py
"""
import sys
from pathlib import Path
from datetime import date

# Add backend directory to sys.path
BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from services.supabase_client import get_supabase_client


def review_due_interventions():
    """
    Find all interventions where:
      - review_date <= today
      - risk_after IS NULL (not yet reviewed)
    Then fetch the student's latest risk score and fill in risk_after.
    """
    supabase = get_supabase_client()
    today = date.today().isoformat()

    # Fetch interventions that are due for review
    try:
        resp = (
            supabase.table("interventions")
            .select("id, student_id, risk_before")
            .is_("risk_after", "null")
            .lte("review_date", today)
            .execute()
        )
        due = resp.data or []
    except Exception as exc:
        print(f"Error fetching due interventions: {exc}")
        return

    if not due:
        print(f"[{today}] No interventions due for review.")
        return

    print(f"[{today}] Found {len(due)} intervention(s) due for review.")

    for intervention in due:
        iid = intervention["id"]
        sid = intervention["student_id"]
        risk_before = intervention.get("risk_before")

        # Fetch the student's latest risk score
        try:
            risk_resp = (
                supabase.table("risk_scores")
                .select("academic_risk")
                .eq("user_id", sid)
                .order("computed_at", desc=True)
                .limit(1)
                .execute()
            )
            risk_after = float(risk_resp.data[0]["academic_risk"]) if risk_resp.data else None
        except Exception as exc:
            print(f"  [SKIP] Could not fetch risk for student {sid}: {exc}")
            continue

        # Update the intervention record
        try:
            supabase.table("interventions").update({
                "risk_after": risk_after,
            }).eq("id", iid).execute()
        except Exception as exc:
            print(f"  [FAIL] Could not update intervention {iid}: {exc}")
            continue

        delta = None
        if risk_before is not None and risk_after is not None:
            delta = round(risk_after - float(risk_before), 4)

        print(f"  [OK] Intervention {iid}: risk_before={risk_before}, risk_after={risk_after}, delta={delta}")

    print("Done.")


if __name__ == "__main__":
    review_due_interventions()
