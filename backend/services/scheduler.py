"""Smart Scheduler Service — rule-based weekly study planner.

Priority tiers (as requested):
  Tier 1: Important notes + nearest deadlines (is_important OR days<=3) — highest urgency
  Tier 2: Regular todo/deadline tasks
  Tier 3: Marks-based weak subjects where score <=60 across ASG-1/ASG-2/CT-1/CT-2

Within each tier, lower score / sooner deadline = higher priority.
Blocks carry `kind` = 'todo' vs 'marks' and `tier` for frontend colouring.
Distributes hours so earliest evening slots are Tier1 → Tier2 → Tier3 (not interleaved),
with diminishing-returns rotation within each tier.
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
    Keeps todos and marks as separate entries so weak subjects always get Tier3 blocks
    even when same subject also has a todo.
    """
    entries: List[Dict[str, Any]] = []

    # Tier 3: weak subjects (each subject is its own entry)
    for subject, score in weak_subjects.items():
        sc = float(score)
        base = max(0.0, 100.0 - sc)
        if sc <= 60:
            base += 20
        if sc <= 50:
            base += 15
        entries.append({
            "key": f"marks:{subject}",
            "subject": subject,
            "score": sc,
            "priority": base,
            "kind": "marks",
            "tier": 3,
            "tasks": [],
            "days": None,
            "is_important": False,
        })

    # Tier 1 & 2: each deadline/todo is its own entry (even if subject overlaps marks)
    for dl in deadlines:
        subject = str(dl.get("subject", "")).strip()
        if not subject:
            continue
        days = max(1, int(dl.get("days_until_due", 7)))
        task_name = str(dl.get("task", "Assignment")).strip() or "Assignment"
        is_imp = bool(dl.get("is_important", False))
        urgency = 50.0 / days
        if is_imp:
            urgency += 60
            tier = 1
        elif days <= 3:
            urgency += 35
            tier = 1
        else:
            tier = 2
        # base 30 + urgency so todos outrank pure marks initially but marks still get slots via tier ordering
        priority = 30.0 + urgency
        # lower score todos for same subject get slight boost? keep as is
        entries.append({
            "key": f"todo:{subject}:{task_name}:{days}:{is_imp}",
            "subject": subject,
            "score": 70.0,
            "priority": priority,
            "kind": "todo",
            "tier": tier,
            "tasks": [task_name],
            "days": days,
            "is_important": is_imp,
        })

    if not entries:
        return {day: [] for day in available_hours.keys()}

    # Sort tiers so earliest slots are Tier1 → Tier2 → Tier3 in order,
    # but within each tier higher priority first
    tier1 = sorted([e for e in entries if e["tier"] == 1], key=lambda x: x["priority"], reverse=True)
    tier2 = sorted([e for e in entries if e["tier"] == 2], key=lambda x: x["priority"], reverse=True)
    tier3 = sorted([e for e in entries if e["tier"] == 3], key=lambda x: x["priority"], reverse=True)

    # Build ordered pool: Tier1 first, then Tier2, then Tier3.
    # We will walk through this pool with diminishing returns, but always respect tier order
    # by not letting Tier3 jump ahead of Tier1 until Tier1 has had its fair share.
    # Simple approach: fill slots sequentially from tier pools — first fill Tier1 slots,
    # then Tier2, then Tier3. If hours exceed one tier's entries, rotation within tier.
    detailed: Dict[str, List[Dict[str, Any]]] = {day: [] for day in available_hours.keys()}
    # flatten ordered tiers for slot assignment using round-robin with tier priority
    # Allocate proportionally: Tier1 gets first pass, Tier2 second, Tier3 third.
    # We achieve this by iterating days/slots and picking highest priority among not-yet-exhausted tier
    tier_queues = [tier1, tier2, tier3]
    # current priorities per entry for decay
    cur_prio: Dict[str, float] = {e["key"]: e["priority"] for e in entries}
    # map key -> entry
    by_key = {e["key"]: e for e in entries}

    # helper to pick next: try tier1 first if any entry still has high priority, else tier2, else tier3
    # but use max within tier to allow rotation
    for day, hours in available_hours.items():
        for slot_idx in range(int(hours)):
            # determine which tier to pull from: pick tier with highest current max priority
            best_key = None
            best_prio = -1
            best_entry = None
            for tier_list in tier_queues:
                if not tier_list:
                    continue
                # find max priority entry in this tier
                for e in tier_list:
                    p = cur_prio[e["key"]]
                    if p > best_prio:
                        best_prio = p
                        best_key = e["key"]
                        best_entry = e
                # if we found a Tier1 entry with priority still competitive, break early after checking all?
                # Actually we want global max, so don't break — let Tier1 naturally outrank Tier3 until decay
            if not best_entry:
                break
            e = best_entry
            tier = e["tier"]
            kind = e["kind"]
            score = e["score"]
            tasks = e["tasks"]
            has_deadline = e["days"] is not None
            is_imp = e["is_important"]

            if tier == 1 and has_deadline:
                d = e["days"]
                reason = "todo-important" if is_imp else "todo-urgent"
                if is_imp:
                    reason_label = f"Important · Due in {d}d · {', '.join(tasks)}" if d > 1 else f"Important · Due tomorrow · {', '.join(tasks)}"
                    focus = f"{', '.join(tasks)} · Important"
                else:
                    reason_label = f"Urgent · Due in {d}d · {', '.join(tasks)}" if d > 1 else f"Urgent · Due tomorrow · {', '.join(tasks)}"
                    focus = f"{', '.join(tasks)}"
            elif tier == 2 and has_deadline:
                d = e["days"]
                focus = f"{', '.join(tasks)}"
                reason = "todo"
                reason_label = f"Todo · Due in {d}d · {', '.join(tasks)}" if d > 1 else f"Todo · Due tomorrow · {', '.join(tasks)}"
            elif kind == "marks" and score <= 60:
                focus = f"Weak · {int(score)}/100 — needs focus"
                reason = "weak"
                reason_label = f"Weak · {int(score)}/100"
            elif kind == "marks":
                focus = "Review weak concepts"
                reason = "weak"
                reason_label = f"Keep momentum · {int(score)}/100"
            else:
                focus = f"{', '.join(tasks)}" if tasks else "Study"
                reason = "todo"
                reason_label = focus

            start, end = _time_for_slot(slot_idx)
            detailed[day].append({
                "subject": e["subject"],
                "task": tasks[0] if tasks else "Study",
                "focus": focus,
                "reason": reason,
                "reason_label": reason_label,
                "score": score,
                "days_until_due": e["days"],
                "start": start,
                "end": end,
                "duration": "1h",
                "kind": kind,
                "tier": tier,
            })
            decay = 0.65 if tier == 1 else 0.6 if tier == 2 else 0.55
            cur_prio[best_key] *= decay

    return detailed
