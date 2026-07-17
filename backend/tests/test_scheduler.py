import os
import sys
from pathlib import Path
import json

# Add backend directory to sys.path to import services
BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from services.scheduler import generate_study_plan

def test_scheduler():
    print("==================================================")
    print("Testing Smart Scheduler")
    print("==================================================")
    
    # Mock Student Data
    weak_subjects = {
        "Math 101": 45,       # High risk
        "Physics 201": 60,    # Medium risk
        "Computer Science": 90 # Low risk
    }
    
    deadlines = [
        {"subject": "Math 101", "task": "Calculus Midterm", "days_until_due": 2}, # Extremely urgent + high risk
        {"subject": "History", "task": "Essay Draft", "days_until_due": 1},       # Urgent, but not a weak subject
        {"subject": "Physics 201", "task": "Lab Report", "days_until_due": 5}     # Medium urgent
    ]
    
    available_hours = {
        "Monday": 2,
        "Tuesday": 3,
        "Wednesday": 2,
        "Thursday": 2,
        "Friday": 1
    }
    
    plan = generate_study_plan(weak_subjects, deadlines, available_hours)
    
    print("\n[Input] Weak Subjects:")
    print(json.dumps(weak_subjects, indent=2))
    print("\n[Input] Upcoming Deadlines:")
    print(json.dumps(deadlines, indent=2))
    
    print("\n[Output] Generated Weekly Study Plan:")
    for day, tasks in plan.items():
        print(f"\n{day}:")
        if not tasks:
            print("  - Free day!")
        for task in tasks:
            print(f"  - {task}")
            
    # Quick sanity checks
    monday_tasks = plan.get("Monday", [])
    if any("Math 101" in t for t in monday_tasks) and any("History" in t for t in monday_tasks):
        print("\n[PASS] Monday correctly prioritized Math (weak + urgent) and History (very urgent).")
    elif any("Math 101" in t for t in monday_tasks):
        print("\n[PASS] Monday correctly heavily prioritized Math 101.")
    else:
        print("\n[WARNING] Scheduler failed to prioritize urgent/weak subjects.")

if __name__ == "__main__":
    test_scheduler()
