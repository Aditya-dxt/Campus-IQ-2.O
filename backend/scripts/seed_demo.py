"""Script to seed backdated interventions for a demo."""
import sys
from pathlib import Path
from datetime import date, timedelta
import uuid

# Add backend directory to sys.path
BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from services.supabase_client import get_supabase_client
from dotenv import load_dotenv

load_dotenv(BACKEND_ROOT / ".env")

def seed_demo_data():
    supabase = get_supabase_client()
    
    # 1. Fetch any mentor
    mentor_resp = supabase.table("users").select("id").eq("role", "mentor").limit(1).execute()
    if not mentor_resp.data:
        print("No mentor found in the database. Please sign up a mentor via the frontend first.")
        return
    mentor_id = mentor_resp.data[0]["id"]
    
    # 2. Fetch any student
    student_resp = supabase.table("users").select("id, name").eq("role", "student").limit(1).execute()
    if not student_resp.data:
        print("No student found in the database. Please sign up a student via the frontend first.")
        return
    student_id = student_resp.data[0]["id"]
    student_name = student_resp.data[0]["name"]
    
    print(f"Seeding data for student: {student_name}")
    
    # 3. Add a few risk scores for the student over time
    supabase.table("risk_scores").insert([
        {
            "user_id": student_id,
            "academic_risk": 0.8500,
            "placement_readiness": 0.2000,
            "top_factor": "Low Attendance",
            "computed_at": (date.today() - timedelta(days=20)).isoformat()
        },
        {
            "user_id": student_id,
            "academic_risk": 0.4500,
            "placement_readiness": 0.6000,
            "top_factor": "Mock Interview Score",
            "computed_at": (date.today() - timedelta(days=2)).isoformat()
        }
    ]).execute()
    
    # 4. Add backdated interventions (one reviewed, one pending)
    supabase.table("interventions").insert([
        {
            "student_id": student_id,
            "mentor_id": mentor_id,
            "action_note": "[academic_tutoring] Assigned 1-on-1 math tutoring for midterms.",
            "risk_before": 0.8500,
            "risk_after": 0.4500, # Reviewed
            "review_date": (date.today() - timedelta(days=5)).isoformat(),
            "created_at": (date.today() - timedelta(days=19)).isoformat()
        },
        {
            "student_id": student_id,
            "mentor_id": mentor_id,
            "action_note": "[counseling] Wellness check regarding recent missed assignments.",
            "risk_before": 0.4500,
            "risk_after": None, # Pending
            "review_date": (date.today() + timedelta(days=5)).isoformat(),
            "created_at": (date.today() - timedelta(days=1)).isoformat()
        }
    ]).execute()
    
    print("Successfully seeded backdated interventions!")

if __name__ == "__main__":
    seed_demo_data()
