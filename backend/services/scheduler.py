"""Smart Scheduler Service — rule-based weekly study planner.

Priority tiers (as requested):
  Tier 1: Important notes + nearest deadlines (is_important OR days<=3) — highest urgency
  Tier 2: Regular todo/deadline tasks
  Tier 3: Marks-based weak subjects where score <=60 across ASG-1/ASG-2/CT-1/CT-2

Within each tier, lower score / sooner deadline = higher priority.
Blocks carry `kind` = 'todo' vs 'marks' and `tier` for frontend colouring.
Distributes hours with diminishing-returns rotation within tier.
"""

from typing import Dict, List, Any
DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
SHORT_MAP = {"Monday": "Mon", "Tuesday": "Tue", "Wednesday": "Wed", "Thursday": "Thu", "Friday": "Fri", "Saturday": "Sat", "Sunday": "Sun"}
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
    { subject, task, focus, reason, reason_label, score, days_until_due, start, end, duration, kind, tier }
    kind: 'todo' (deadline/note) vs 'marks' (weak subject) — for colouring
    tier: 1=important+near deadline, 2=regular todo, 3=marks-based
    """
    subject_priorities: Dict[str, float] = {}
    subject_scores: Dict[str, float] = {}
    subject_tasks: Dict[str, List[str]] = {}
    subject_deadline_days: Dict[str, int] = {}
    subject_kind: Dict[str, str] = {}  # todo vs marks
    subject_tier: Dict[str, int] = {}
    subject_is_important: Dict[str, bool] = {}

    # ---- Tier 3 base: weak subjects (marks <=60 are boosted) ----
    for subject, score in weak_subjects.items():
        sc = float(score)
        # Base priority inversely proportional to score; <=60 gets extra boost
        base = max(0.0, 100.0 - sc)
        if sc <= 60:
            base += 20  # push weak subjects above borderline 61-70
        if sc <= 50:
            base += 15
        subject_priorities[subject] = base
        subject_scores[subject] = sc
        subject_kind[subject] = "marks"
        subject_tier[subject] = 3

    # ---- Tier 1 & 2: deadlines/todos ----
    for dl in deadlines:
        subject = dl["subject"]
        days = max(1, int(dl.get("days_until_due", 7)))
        task_name = dl.get("task", "Assignment")
        is_imp = bool(dl.get("is_important", False))
        # if subject already exists as marks, upgrade to todo with merged priority
        if subject not in subject_priorities:
            subject_priorities[subject] = 30.0
            subject_scores[subject] = 70.0
        # urgency: 50/days base + important bonus
        urgency = 50.0 / days
        if is_imp:
            urgency += 60  # Tier 1: most important first
        elif days <= 3:
            urgency += 35  # near deadline also Tier 1
        subject_priorities[subject] += urgency
        subject_tasks.setdefault(subject, []).append(task_name)
        if subject not in subject_deadline_days or days < subject_deadline_days[subject]:
            subject_deadline_days[subject] = days
        # mark kind/tier: important or near deadline = Tier 1 todo, else Tier 2 todo
        if is_imp or days <= 3:
            subject_kind[subject] = "todo"
            subject_tier[subject] = 1
        else:
            # if previously tier 1, keep 1; else set to 2
            if subject_tier.get(subject, 3) != 1:
                subject_kind[subject] = "todo"
                subject_tier[subject] = 2
        subject_is_important[subject] = subject_is_important.get(subject, False) or is_imp

    if not subject_priorities:
        return {day: [] for day in available_hours.keys()}

    sorted_subjects = sorted(subject_priorities.items(), key=lambda x: x[1], reverse=True)
    if not sorted_subjects:
        return {day: [] for day in available_hours.keys()}
    current_priorities = dict(sorted_subjects)
    detailed: Dict[str, List[Dict[str, Any]]] = {day: [] for day in available_hours.keys()}

    for day, hours in available_hours.items():
        for slot_idx in range(int(hours)):
            top_subject = max(current_priorities.items(), key=lambda x: x[1])[0]
            tasks = subject_tasks.get(top_subject, [])
            tier = subject_tier.get(top_subject, 3)
            kind = subject_kind.get(top_subject, "marks")
            score = subject_scores.get(top_subject, 70)
            has_deadline = top_subject in subject_deadline_days
            is_imp = subject_is_important.get(top_subject, False)

            if tier == 1 and has_deadline:
                d = subject_deadline_days[top_subject]
                focus = f"{', '.join(tasks)}" + (" · Important" if is_imp else "")
                reason = "todo-important"
                reason_label = f"Important · Due in {d}d · {', '.join(tasks)}" if d > 1 else f"Important · Due tomorrow · {', '.join(tasks)}"
                if not is_imp:
                    reason = "todo-urgent"
                    reason_label = f"Urgent · Due in {d}d · {', '.join(tasks)}"
            elif tier == 2 and has_deadline:
                d = subject_deadline_days[top_subject]
                focus = f"{', '.join(tasks)}"
                reason = "todo"
                reason_label = f"Todo · Due in {d}d · {', '.join(tasks)}" if d > 1 else f"Todo · Due tomorrow · {', '.join(tasks)}"
            elif score <= 60:
                focus = f"Weak · {int(score)}/100 — needs focus"
                reason = "weak"
                reason_label = f"Weak · {int(score)}/100"
            else:
                focus = "Review weak concepts"
                reason = "weak" if kind == "marks" else "todo"
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
                "kind": kind,
                "tier": tier,
            })
            # diminishing returns — Tier 1 decays slower (keeps priority longer)
            decay = 0.65 if tier == 1 else 0.6 if tier == 2 else 0.55
            current_priorities[top_subject] *= decay

    return detailed
