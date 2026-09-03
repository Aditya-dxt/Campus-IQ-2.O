"""PSIT ERP scraper — logs into erp.psit.ac.in and extracts real attendance + marks.

Flow:
  GET  https://erp.psit.ac.in/             -> ci_session cookie
  POST https://erp.psit.ac.in/Erp/Auth     {username, password}
  GET  https://erp.psit.ac.in/Student/Dashboard               -> attendance
  GET  https://erp.psit.ac.in/Student/TestSubjectMarksReport  -> marks (CT-1, ASG-1 etc.)

No credentials are stored — one-time scrape that updates student_profiles.
"""

from __future__ import annotations

import re
from typing import Any

import httpx
from bs4 import BeautifulSoup

ERP_BASE = "https://erp.psit.ac.in"
ERP_AUTH = f"{ERP_BASE}/Erp/Auth"
ERP_DASHBOARD = f"{ERP_BASE}/Student/Dashboard"
ERP_MARKS_REPORT = f"{ERP_BASE}/Student/TestSubjectMarksReport"
TIMEOUT = httpx.Timeout(15.0, connect=10.0)


def _parse_attendance(html: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ", strip=True)
    tl = p = pf = ab = None
    m = re.search(r"TL\s*-\s*(\d+)\s*\|\s*P\s*-\s*(\d+)\s*\|\s*PF\s*-\s*(\d+)\s*\|\s*Ab\s*-\s*(\d+)", text, re.I)
    if m:
        tl, p, pf, ab = map(int, m.groups())
    with_pf = without_pf = None
    m2 = re.search(r"With PF\s*:\s*([\d.]+)\s*%\s*\|\s*Without PF\s*:\s*([\d.]+)\s*%", text, re.I)
    if m2:
        with_pf, without_pf = map(float, m2.groups())
    if tl is None:
        for tag in soup.find_all(string=re.compile(r"Attendance", re.I)):
            parent = tag.parent
            if parent:
                snippet = parent.parent.get_text(" ", strip=True) if parent.parent else parent.get_text(" ", strip=True)
                m3 = re.search(r"TL\s*-\s*(\d+)", snippet)
                if m3:
                    m = re.search(r"TL\s*-\s*(\d+)\s*\|\s*P\s*-\s*(\d+)\s*\|\s*PF\s*-\s*(\d+)\s*\|\s*Ab\s*-\s*(\d+)", snippet, re.I)
                    if m:
                        tl, p, pf, ab = map(int, m.groups())
                    m2b = re.search(r"With PF\s*:\s*([\d.]+)", snippet, re.I)
                    if m2b:
                        with_pf = float(m2b.group(1))
                    break
    student_name = None
    profile_match = re.search(r"([A-Z][a-z]+\s+[A-Z][a-z]+)\s*\n?.*PSIT-", text)
    if profile_match:
        student_name = profile_match.group(1).strip()
    section = None
    sec_m = re.search(r"(PSIT-[A-Z]+-[A-Z0-9-]+)", text)
    if sec_m:
        section = sec_m.group(1)
    attendance_pct = None
    if with_pf is not None:
        attendance_pct = float(with_pf)
    elif tl and tl > 0 and p is not None:
        attendance_pct = round((p / tl) * 100, 2)
    return {
        "raw_text_snippet": text[:800],
        "tl": tl,
        "present": p,
        "pf": pf,
        "absent": ab,
        "with_pf_pct": with_pf,
        "without_pf_pct": without_pf,
        "attendance_pct": attendance_pct,
        "student_name": student_name,
        "section": section,
    }


def _parse_marks_table(html: str) -> list[dict[str, Any]]:
    """Parse any subject/marks table in HTML. Returns list of {subject, marks, max_marks, percent}."""
    soup = BeautifulSoup(html, "html.parser")
    results: list[dict[str, Any]] = []
    # Find all tables
    for table in soup.find_all("table"):
        headers = [th.get_text(strip=True).lower() for th in table.find_all("th")]
        # Heuristic: table with subject/marks columns
        if not headers:
            continue
        has_subject = any("subject" in h or "course" in h or "paper" in h for h in headers)
        has_marks = any("mark" in h or "score" in h or "obtained" in h for h in headers)
        if not (has_subject and has_marks):
            continue
        # Map column indices
        subj_idx = next((i for i, h in enumerate(headers) if "subject" in h or "course" in h or "paper" in h), 0)
        marks_idx = next((i for i, h in enumerate(headers) if "mark" in h and "max" not in h and "total" not in h), None)
        if marks_idx is None:
            marks_idx = next((i for i, h in enumerate(headers) if "obtained" in h or "score" in h), 1)
        max_idx = next((i for i, h in enumerate(headers) if "max" in h or "total" in h or "out of" in h), None)
        for row in table.find_all("tr")[1:]:
            cols = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
            if len(cols) <= max(subj_idx, marks_idx or 0):
                continue
            subject = cols[subj_idx].strip()
            if not subject or subject.lower() in ("subject", "course", "no data available in table"):
                continue
            if "no data" in " ".join(cols).lower():
                continue
            marks_raw = cols[marks_idx] if marks_idx is not None and marks_idx < len(cols) else ""
            # Extract numeric marks like "18/20", "45", "38 / 50"
            m = re.search(r"(\d+(?:\.\d+)?)\s*(?:/\s*(\d+(?:\.\d+)?))?", marks_raw)
            if not m:
                continue
            marks = float(m.group(1))
            max_marks = float(m.group(2)) if m.group(2) else None
            if max_idx is not None and max_idx < len(cols):
                max_raw = cols[max_idx]
                mx = re.search(r"(\d+(?:\.\d+)?)", max_raw)
                if mx:
                    max_marks = float(mx.group(1))
            # Convert to 0-100 percent
            if max_marks and max_marks > 0:
                percent = round((marks / max_marks) * 100, 2)
            else:
                # Assume marks already 0-100 or 0-20 -> scale if <=20
                percent = marks if marks <= 100 else marks
            results.append({"subject": subject, "marks": marks, "max_marks": max_marks, "percent": percent, "raw": marks_raw})
    return results


def _fetch_marks(client: httpx.Client) -> dict[str, Any]:
    """Try to scrape subject-wise marks from ERP. Tries multiple strategies."""
    all_marks: list[dict[str, Any]] = []
    debug: list[str] = []

    # Strategy 1: GET the marks report page directly
    try:
        r = client.get(ERP_MARKS_REPORT, timeout=TIMEOUT)
        html = r.text
        # Check if redirected to login
        if 'name="username"' in html and 'name="password"' in html:
            debug.append("marks page redirected to login — session expired")
            return {"subjects": [], "debug": debug}
        # Try to parse any table already present
        parsed = _parse_marks_table(html)
        if parsed:
            debug.append(f"GET {ERP_MARKS_REPORT}: found {len(parsed)} rows")
            all_marks.extend(parsed)
        else:
            debug.append("GET marks report: no table found, trying POST Show")

        # Strategy 2: Try POST Show for known test names (CT-1, ASG-1, CT-2 etc.)
        # The page has a dropdown with options we can discover
        soup = BeautifulSoup(html, "html.parser")
        # Discover test options from <option> tags
        options: list[str] = []
        for opt in soup.find_all("option"):
            txt = opt.get_text(strip=True)
            if txt and txt.lower() not in ("select test here", "select test"):
                options.append(txt)
        # Also add common tests if not discovered
        for t in ["CT-1", "CT-2", "CT-3", "ASG-1", "ASG-2", "ST-1", "PUT"]:
            if t not in options:
                options.append(t)
        options = options[:8]  # limit to avoid hammering ERP

        for test_name in options:
            # Try several POST payload variants ERP might expect
            tried = False
            for payload in [
                {"test": test_name},
                {"test_name": test_name},
                {"test_id": test_name},
                {"testId": test_name},
                {"exam": test_name},
                {"select_test": test_name},
            ]:
                try:
                    # Some ERPs use POST to same URL, some use AJAX endpoint
                    resp = client.post(ERP_MARKS_REPORT, data=payload, timeout=TIMEOUT)
                    if 'name="username"' in resp.text:
                        break  # session died
                    p2 = _parse_marks_table(resp.text)
                    if p2:
                        # Tag with test name
                        for row in p2:
                            row["test"] = test_name
                        all_marks.extend(p2)
                        debug.append(f"POST {test_name} with {list(payload.keys())[0]}: found {len(p2)} rows")
                        tried = True
                        break
                except Exception as e:
                    debug.append(f"POST {test_name} failed: {e}")
            if not tried:
                # Try AJAX endpoints
                for ajax_url in [
                    f"{ERP_BASE}/Student/GetTestMarks",
                    f"{ERP_BASE}/Student/GetStudentMarks",
                    f"{ERP_BASE}/Student/MarksReport",
                    f"{ERP_BASE}/Student/FetchMarks",
                ]:
                    try:
                        resp = client.post(ajax_url, data={"test": test_name}, timeout=TIMEOUT)
                        if resp.status_code == 404:
                            continue
                        p2 = _parse_marks_table(resp.text)
                        # Also try JSON
                        if not p2:
                            try:
                                j = resp.json()
                                if isinstance(j, list):
                                    for item in j:
                                        subj = item.get("subject") or item.get("Subject") or item.get("course")
                                        mk = item.get("marks") or item.get("Marks") or item.get("obtained")
                                        if subj and mk is not None:
                                            percent = float(mk) if float(mk) <= 100 else float(mk)
                                            all_marks.append({"subject": subj, "marks": float(mk), "max_marks": None, "percent": percent, "test": test_name})
                                    if j:
                                        debug.append(f"JSON {ajax_url} test {test_name}: {len(j)} rows")
                            except Exception:
                                pass
                        if p2:
                            for row in p2:
                                row["test"] = test_name
                            all_marks.extend(p2)
                            debug.append(f"AJAX {ajax_url} test {test_name}: {len(p2)} rows")
                            break
                    except Exception:
                        continue

    except Exception as e:
        debug.append(f"marks fetch error: {e}")

    # Deduplicate by (subject, test)
    seen = set()
    deduped: list[dict[str, Any]] = []
    for m in all_marks:
        key = (m["subject"].lower().strip(), m.get("test", ""))
        if key not in seen:
            seen.add(key)
            deduped.append(m)

    # Compute average percent for past_marks
    avg_percent = None
    if deduped:
        vals = [r["percent"] for r in deduped if r.get("percent") is not None]
        if vals:
            avg_percent = round(sum(vals) / len(vals), 2)

    return {"subjects": deduped, "avg_percent": avg_percent, "debug": debug}


def scrape_psit_erp(username: str, password: str) -> dict[str, Any]:
    """
    Log into PSIT ERP and scrape dashboard + marks.
    Raises ValueError with user-friendly message on failure.
    Returns dict with attendance, marks and metadata.
    """
    if not username or not password:
        raise ValueError("ERP User ID and password are required.")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": ERP_BASE + "/",
    }

    with httpx.Client(timeout=TIMEOUT, follow_redirects=True, headers=headers) as client:
        # 1. GET login page to obtain ci_session
        try:
            r = client.get(ERP_BASE + "/", timeout=TIMEOUT)
            r.raise_for_status()
        except Exception as e:
            raise ValueError(f"Could not reach PSIT ERP ({e}). Try again or check your internet.") from e

        # 2. POST credentials
        try:
            resp = client.post(
                ERP_AUTH,
                data={"username": username.strip(), "password": password},
                headers={**headers, "Content-Type": "application/x-www-form-urlencoded", "Origin": ERP_BASE, "Referer": ERP_BASE + "/"},
            )
        except Exception as e:
            raise ValueError(f"ERP login request failed ({e}).") from e

        body = resp.text
        if "Invalid" in body or "incorrect" in body.lower() or "password has expired" in body.lower():
            soup = BeautifulSoup(body, "html.parser")
            err = soup.get_text(" ", strip=True)[:300]
            if "Invalid" in err or "incorrect" in err.lower():
                raise ValueError("Invalid PSIT ERP credentials — check your Roll Number / Password.")
            if "expired" in err.lower():
                raise ValueError("Your PSIT ERP password has expired — please change it at erp.psit.ac.in/Erp/ForgetPassword first.")

        if 'name="username"' in body and "Dashboard" not in body and "My Attendance" not in body:
            pass

        # 3. GET dashboard for attendance
        try:
            dash = client.get(ERP_DASHBOARD, timeout=TIMEOUT)
            dash.raise_for_status()
            html = dash.text
        except Exception as e:
            raise ValueError(f"Logged in but could not load ERP dashboard ({e}).") from e

        if 'name="username"' in html and 'name="password"' in html:
            raise ValueError("PSIT ERP login failed — invalid credentials or session expired. Try again.")

        parsed = _parse_attendance(html)
        parsed["dashboard_html_length"] = len(html)

        if parsed["attendance_pct"] is None:
            raise ValueError(
                "Logged into PSIT ERP but could not find attendance data on the dashboard. "
                "The ERP layout may have changed — please share a screenshot with support. "
                f"Snippet: {parsed['raw_text_snippet'][:300]}"
            )

        # 4. Fetch marks (non-fatal — dashboard may have no marks yet)
        marks_data = _fetch_marks(client)

        return {
            "erp_id": username.strip(),
            "attendance_pct": parsed["attendance_pct"],
            "with_pf_pct": parsed["with_pf_pct"],
            "without_pf_pct": parsed["without_pf_pct"],
            "tl": parsed["tl"],
            "present": parsed["present"],
            "pf": parsed["pf"],
            "absent": parsed["absent"],
            "section": parsed["section"],
            "marks": marks_data["subjects"],
            "avg_marks_percent": marks_data["avg_percent"],
            "marks_debug": marks_data["debug"],
            "scraped_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        }
