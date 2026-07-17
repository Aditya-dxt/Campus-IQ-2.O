"""Smart Scheduler Service

A rule-based algorithm to generate weekly study plans for students.
Prioritizes subjects based on academic risk (low scores) and urgency (upcoming deadlines).
"""
import math
from typing import Dict, List, Any

def generate_study_plan(
    weak_subjects: Dict[str, float], 
    deadlines: List[Dict[str, Any]], 
    available_hours: Dict[str, int]
) -> Dict[str, List[str]]:
    """
    Generates a weekly study plan.
    
    Args:
        weak_subjects: Dict of subject name to current score (0-100). Example: {"Math": 45, "CS": 85}
        deadlines: List of task dicts. Example: [{"subject": "Math", "task": "Midterm", "days_until_due": 3}]
        available_hours: Dict of day to available hours. Example: {"Monday": 2, "Tuesday": 1}
        
    Returns:
        Dict mapping day of the week to a list of study tasks.
    """
    
    # 1. Calculate Priority Scores for each subject
    # Base priority comes from how low the score is (Risk Factor)
    subject_priorities = {}
    for subject, score in weak_subjects.items():
        # A score of 40 yields a risk priority of 60
        # A score of 95 yields a risk priority of 5
        risk_factor = max(0.0, 100.0 - score)
        subject_priorities[subject] = risk_factor
        
    # Add Urgency Factor for upcoming deadlines
    # The closer the deadline, the higher the urgency bonus.
    subject_tasks = {} # Keep track of tasks to mention them in the schedule
    for dl in deadlines:
        subject = dl["subject"]
        days = max(1, dl.get("days_until_due", 7))
        task_name = dl.get("task", "Assignment")
        
        # If the subject wasn't in weak_subjects, initialize it with a neutral base priority (e.g. 30)
        if subject not in subject_priorities:
            subject_priorities[subject] = 30.0
            
        # Add an urgency bonus. If due tomorrow (1 day), add 50 points. If due in 10 days, add 5 points.
        urgency_bonus = 50.0 / days
        subject_priorities[subject] += urgency_bonus
        
        if subject not in subject_tasks:
            subject_tasks[subject] = []
        subject_tasks[subject].append(task_name)
        
    # 2. Sort subjects by total priority (Highest first)
    sorted_subjects = sorted(subject_priorities.items(), key=lambda x: x[1], reverse=True)
    if not sorted_subjects:
        return {day: ["Free day! No urgent tasks or weak subjects detected."] for day in available_hours.keys() if available_hours[day] > 0}
        
    # 3. Time Allocation (Distribute available hours to top priority subjects)
    study_plan = {day: [] for day in available_hours.keys()}
    
    # We will allocate hours one by one to the highest priority subject, 
    # slightly decreasing its priority each time so we don't only study one subject all week.
    
    # Copy priorities for stateful reduction
    current_priorities = dict(sorted_subjects)
    
    for day, hours in available_hours.items():
        for _ in range(hours):
            # Find the subject that currently has the highest priority
            top_subject = max(current_priorities.items(), key=lambda x: x[1])[0]
            
            # Format the task description
            tasks = subject_tasks.get(top_subject, [])
            focus_str = f"Focus on {', '.join(tasks)}" if tasks else "Review weak concepts"
            
            study_plan[day].append(f"1 Hour: {top_subject} ({focus_str})")
            
            # Reduce the priority of the subject we just studied so we rotate subjects
            # (Diminishing returns for studying the same subject continuously)
            current_priorities[top_subject] *= 0.6
            
    return study_plan
