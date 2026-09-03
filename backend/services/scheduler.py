"""Smart Scheduler Service — rule-based weekly study planner.

Prioritises subjects by (100 - score) + urgency bonus (50 / days_until_due)
and distributes hours with diminishing-returns rotation.
"""

from typing import Dict, List, Any

DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
SHORT_MAP = {"Monday": "Mon", "Tuesday": "Tue", "Wednesday": "Wed", "Thursday": "Thu", "Friday": "Fri", "Saturday": "Sat", "Sunday": "Sun"}

# Evening slot start hours for visual time blocks (18:00, 19:00, ...)
BASE_HOUR = 18


def _time_for_slot(idx: int) -> tuple[str, str]:
    h = BASE_HOUR + idx
    return f"{h:02d}:00", f"{h+1:02d}:00"


def generate_study_plan(
    weak_subjects: Dict[str, float],
    deadlines: List[Dict[str, Any]],
    available_hours: Dict[str, int],
) -> Dict[str, List[str]]:
    """Legacy string plan — kept for backward compat. See generate_detailed_plan."""
    detailed = generate_detailed_plan(weak_subjects, deadlines, available_hours)
    # Convert detailed blocks back to legacy strings for existing callers
    legacy: Dict[str, List[str]] = {}
    for day, blocks in detailed.items():
        legacy[day] = [f"1 Hour: {b['subject']} ({b['focus']})" for b in blocks]
    return legacy


def generate_detailed_plan(
    weak_subjects: Dict[str, float],
    deadlines: List[Dict[str, Any]],
    available_hours: Dict[str, int],
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Returns Dict[day, List[block]] where each block is:
    { subject, task, focus, reason, reason_label, score, days_until_due, start, end, duration }
    """
    subject_priorities: Dict[str, float] = {}
    subject_scores: Dict[str, float] = {}
    subject_tasks: Dict[str, List[str]] = {}
    subject_deadline_days: Dict[str, int] = {}

    for subject, score in weak_subjects.items():
        risk_factor = max(0.0, 100.0 - float(score))
        subject_priorities[subject] = risk_factor
        subject_scores[subject] = float(score)

    for dl in deadlines:
        subject = dl["subject"]
        days = max(1, int(dl.get("days_until_due", 7)))
        task_name = dl.get("task", "Assignment")
        if subject not in subject_priorities:
            subject_priorities[subject] = 30.0
            subject_scores[subject] = 70.0
        urgency_bonus = 50.0 / days
        subject_priorities[subject] += urgency_bonus
        subject_tasks.setdefault(subject, []).append(task_name)
        # track nearest deadline for reason label
        if subject not in subject_deadline_days or days < subject_deadline_days[subject]:
            subject_deadline_days[subject] = days

    if not subject_priorities:
        # No data — return empty plan (frontend will show onboarding)
        return {day: [] for day in available_hours.keys()}

    # sort for stable initial order
    sorted_subjects = sorted(subject_priorities.items(), key=lambda x: x[1], reverse=True)
    if not sorted_subjects:
        return {day: [] for day in available_hours.keys()}

    current_priorities = dict(sorted_subjects)
    detailed: Dict[str, List[Dict[str, Any]]] = {day: [] for day in available_hours.keys()}

    for day, hours in available_hours.items():
        for slot_idx in range(int(hours)):
            top_subject = max(current_priorities.items(), key=lambda x: x[1])[0]
            tasks = subject_tasks.get(top_subject, [])
            has_deadline = top_subject in subject_deadline_days
            score = subject_scores.get(top_subject, 70)

            if has_deadline:
                d = subject_deadline_days[top_subject]
                focus = f"Focus on {', '.join(tasks)}"
                reason = "deadline"
                reason_label = f"Due in {d}d · {', '.join(tasks)}" if d > 1 else f"Due tomorrow · {', '.join(tasks)}"
            elif score < 50:
                focus = "Review weak concepts"
                reason = "weak"
                reason_label = f"Weak area · {int(score)}/100"
            else:
                focus = "Review weak concepts"
                reason = "placement"
                reason_label = f"Keep momentum · {int(score)}/100"

            start, end = _time_for_slot(slot_idx)

            detailed[day].append({
                "subject": top_subject,
                "task": tasks[0] if tasks else "Study",
                "focus": focus,
                "reason": reason,
                "reason_label": reason_label,
                "score": score,
                "days_until_due": subject_deadline_days.get(top_subject),
                "start": start,
                "end": end,
                "duration": "1h",
            })
            # diminishing returns
            current_priorities[top_subject] *= 0.6

    return detailed
