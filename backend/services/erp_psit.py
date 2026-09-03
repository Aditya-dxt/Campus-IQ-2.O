"""PSIT ERP scraper — logs into erp.psit.ac.in and extracts real attendance/marks.

Flow:
  GET  https://erp.psit.ac.in/  -> ci_session cookie
  POST https://erp.psit.ac.in/Erp/Auth  {username, password}
  GET  https://erp.psit.ac.in/Student/Dashboard  -> parse attendance card

Parsing is resilient: looks for the "My Attendance" card with text like
  TL- 305 | P- 280 | PF- 8 | Ab- 17   and   With PF: 94.43 % | Without PF: 91.80 %

No credentials are stored — this is a one-time scrape that updates
student_profiles directly for the authenticated CampusIQ user.
"""

from __future__ import annotations

import re
from typing import Any

import httpx
from bs4 import BeautifulSoup

ERP_BASE = "https://erp.psit.ac.in"
ERP_AUTH = f"{ERP_BASE}/Erp/Auth"
ERP_DASHBOARD = f"{ERP_BASE}/Student/Dashboard"

TIMEOUT = httpx.Timeout(15.0, connect=10.0)


def _parse_attendance(html: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ", strip=True)

    # Try to find TL/P/PF/Ab pattern
    # e.g. "TL- 305 | P- 280 | PF- 8 | Ab- 17"
    tl = p = pf = ab = None
    m = re.search(r"TL\s*-\s*(\d+)\s*\|\s*P\s*-\s*(\d+)\s*\|\s*PF\s*-\s*(\d+)\s*\|\s*Ab\s*-\s*(\d+)", text, re.I)
    if m:
        tl, p, pf, ab = map(int, m.groups())

    # With PF / Without PF percentages
    with_pf = without_pf = None
    m2 = re.search(r"With PF\s*:\s*([\d.]+)\s*%\s*\|\s*Without PF\s*:\s*([\d.]+)\s*%", text, re.I)
    if m2:
        with_pf, without_pf = map(float, m2.groups())

    # Fallback: look for any "My Attendance" card vicinity
    # If still None, try to find any attendance-like numbers in .card elements
    if tl is None:
        # search in all elements containing "Attendance"
        for tag in soup.find_all(string=re.compile(r"Attendance", re.I)):
            parent = tag.parent
            if parent:
                snippet = parent.parent.get_text(" ", strip=True) if parent.parent else parent.get_text(" ", strip=True)
                m3 = re.search(r"TL\s*-\s*(\d+)", snippet)
                if m3:
                    # re-parse from snippet
                    m = re.search(r"TL\s*-\s*(\d+)\s*\|\s*P\s*-\s*(\d+)\s*\|\s*PF\s*-\s*(\d+)\s*\|\s*Ab\s*-\s*(\d+)", snippet, re.I)
                    if m:
                        tl, p, pf, ab = map(int, m.groups())
                    m2b = re.search(r"With PF\s*:\s*([\d.]+)", snippet, re.I)
                    if m2b:
                        with_pf = float(m2b.group(1))
                    break

    # Extract student details from dashboard if available
    student_name = None
    # The dashboard shows a profile card with name like "Aditya Dixit" near "PSIT-CS-III-M"
    # Try to find the name in the profile section
    profile_match = re.search(r"([A-Z][a-z]+\s+[A-Z][a-z]+)\s*\n?.*PSIT-", text)
    if profile_match:
        student_name = profile_match.group(1).strip()

    section = None
    sec_m = re.search(r"(PSIT-[A-Z]+-[A-Z0-9-]+)", text)
    if sec_m:
        section = sec_m.group(1)

    # Compute attendance_pct for CampusIQ (use With PF as primary, as it includes permissible leaves)
    attendance_pct = None
    if with_pf is not None:
        attendance_pct = float(with_pf)
    elif tl and tl > 0 and p is not None:
        attendance_pct = round((p / tl) * 100, 2)
        # If PF exists, alternative without PF is P / (TL) ; with PF is P / (TL - PF) ? Use given formula
        # Actually PSIT "With PF" = P / (TL - PF) ? Let's trust scraped with_pf when available

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


def scrape_psit_erp(username: str, password: str) -> dict[str, Any]:
    """
    Log into PSIT ERP and scrape dashboard.
    Raises ValueError with user-friendly message on failure.
    Returns dict with attendance and raw html for debugging.
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

        # Check for login failure indicators
        body = resp.text
        # ERP returns 200 with error message on failure, or redirects to Dashboard on success
        # Look for failure strings
        if "Invalid" in body or "incorrect" in body.lower() or "password has expired" in body.lower():
            # Try to extract error
            soup = BeautifulSoup(body, "html.parser")
            err = soup.get_text(" ", strip=True)[:300]
            if "Invalid" in err or "incorrect" in err.lower():
                raise ValueError("Invalid PSIT ERP credentials — check your Roll Number / Password.")
            if "expired" in err.lower():
                raise ValueError("Your PSIT ERP password has expired — please change it at erp.psit.ac.in/Erp/ForgetPassword first.")

        # If still on login page (contains "Sign in" and no Dashboard markers), treat as failure
        if 'name="username"' in body and "Dashboard" not in body and "My Attendance" not in body:
            # Might need to follow redirect manually — check history
            if resp.history:
                pass
            # Try to see if we got redirected to dashboard already — fetch it explicitly
            pass

        # 3. GET dashboard (use same session)
        try:
            dash = client.get(ERP_DASHBOARD, timeout=TIMEOUT)
            dash.raise_for_status()
            html = dash.text
        except Exception as e:
            raise ValueError(f"Logged in but could not load ERP dashboard ({e}).") from e

        # If dashboard still shows login form, login failed
        if 'name="username"' in html and 'name="password"' in html:
            raise ValueError("PSIT ERP login failed — invalid credentials or session expired. Try again.")

        parsed = _parse_attendance(html)
        parsed["dashboard_html_length"] = len(html)

        if parsed["attendance_pct"] is None:
            # Include snippet for debugging
            raise ValueError(
                "Logged into PSIT ERP but could not find attendance data on the dashboard. "
                "The ERP layout may have changed — please share a screenshot with support. "
                f"Snippet: {parsed['raw_text_snippet'][:300]}"
            )

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
            "scraped_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        }
