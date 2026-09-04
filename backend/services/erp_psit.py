"""PSIT ERP scraper — attendance + marks with auto-discovered form field."""

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
                m = re.search(r"TL\s*-\s*(\d+)\s*\|\s*P\s*-\s*(\d+)\s*\|\s*PF\s*-\s*(\d+)\s*\|\s*Ab\s*-\s*(\d+)", snippet, re.I)
                if m:
                    tl, p, pf, ab = map(int, m.groups())
                m2b = re.search(r"With PF\s*:\s*([\d.]+)", snippet, re.I)
                if m2b:
                    with_pf = float(m2b.group(1))
                break
    section = None
    sec_m = re.search(r"(PSIT-[A-Z]+-[A-Z0-9-]+)", text)
    if sec_m:
        section = sec_m.group(1)
    attendance_pct = float(with_pf) if with_pf is not None else (round((p / tl) * 100, 2) if tl and p is not None and tl > 0 else None)
    return {"raw_text_snippet": text[:800], "tl": tl, "present": p, "pf": pf, "absent": ab, "with_pf_pct": with_pf, "without_pf_pct": without_pf, "attendance_pct": attendance_pct, "section": section}


def _is_subject_code(s: str) -> bool:
    """True for codes like BCS-052, KCS-501, BCS052, etc."""
    return bool(re.match(r"^[A-Z]{2,5}-?\d{2,4}[A-Z]?$", s.strip(), re.I))

def _looks_like_subject(s: str) -> bool:
    s = s.strip()
    if not s or len(s) < 3 or "no data" in s.lower():
        return False
    # Subject codes are strong signal
    if _is_subject_code(s):
        return True
    # Or like "Data Structures", "Operating System" — at least 2 words or long token
    if re.match(r"^[A-Za-z ]{4,}$", s) and len(s) <= 60:
        # Exclude generic headers
        if s.lower() in ("subject", "course", "paper", "s.no", "sno", "sr no", "sr.no"):
            return False
        return True
    return False

def _parse_marks_table(html: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    results: list[dict[str, Any]] = []

    for table in soup.find_all("table"):
        # Quick skip for DataTables empty placeholder
        table_text = table.get_text(" ", strip=True)
        if "no data available" in table_text.lower() and len(table.find_all("tr")) <= 2:
            continue

        # Collect headers (th or first row td)
        headers = [th.get_text(strip=True) for th in table.find_all("th")]
        # Normalize lower for detection but keep original
        headers_lower = [h.lower() for h in headers]
        if not headers:
            first = table.find("tr")
            if first:
                headers = [td.get_text(strip=True) for td in first.find_all(["td", "th"])]
                headers_lower = [h.lower() for h in headers]

        # Check for transposed layout: header row contains test names like CT-1, ASG-1, ST-1
        # e.g. | Subject | CT-1 | ASG-1 | CT-2 |  → subject in col 0, each col is a test
        has_test_header = any(re.match(r"^(CT|ASG|AT|ST|PUT|UT)-\d+$", h.strip(), re.I) for h in headers)
        if has_test_header:
            # Build test name per column index
            test_per_col: dict[int, str] = {}
            subj_col = None
            for idx, h in enumerate(headers):
                if re.match(r"^(CT|ASG|AT|ST|PUT|UT)-\d+$", h.strip(), re.I):
                    test_per_col[idx] = h.strip().upper()
                elif "subject" in h.lower() or "course" in h.lower() or "paper" in h.lower() or "code" in h.lower():
                    subj_col = idx
            if subj_col is None:
                subj_col = 0  # assume first col is subject
                # but don't treat it as test col
                test_per_col.pop(subj_col, None)
            # Need at least one test column
            if test_per_col:
                rows = table.find_all("tr")
                # Skip header row if it was th-based; if headers came from first tr, skip it
                start = 1 if headers else 1
                # If headers were th, rows[0] is header; otherwise rows[0] is header we used
                for row in rows[start:]:
                    cols = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
                    if len(cols) <= subj_col:
                        continue
                    subject = cols[subj_col].strip()
                    if not _looks_like_subject(subject):
                        continue
                    for col_idx, test_name in test_per_col.items():
                        if col_idx >= len(cols):
                            continue
                        raw = cols[col_idx].strip()
                        if not raw or raw == "-" or raw.lower() in ("ab", "absent"):
                            continue
                        m = re.search(r"(\d+(?:\.\d+)?)\s*(?:/\s*(\d+(?:\.\d+)?))?", raw)
                        if not m:
                            continue
                        marks = float(m.group(1))
                        max_marks = float(m.group(2)) if m.group(2) else None
                        # PSIT ASG-1 often out of 10 — keep percent as raw if max missing
                        # Heuristic: if marks <= 10 and no max, assume out of 10 -> percent = marks*10
                        # But original data was like 9.5 (out of 10) — we want percent 95
                        # However we store marks + max separately; percent computed
                        if max_marks is None:
                            # Try to guess max from test type: ASG often 10, CT often 20/30
                            # Keep marks as-is and percent = marks (if ≤20 treat as scaled later by dashboard)
                            # Better: if marks ≤10 and test is ASG, percent = marks*10
                            if test_name.upper().startswith("ASG") and marks <= 10:
                                percent = round(marks * 10, 2)
                                max_marks = 10.0
                            elif marks <= 20:
                                # Keep raw — dashboard will show avg as-is; but compute percent as marks*5
                                percent = round(marks * 5, 2) if marks <= 20 else marks
                                # leave max_marks None to indicate guess
                            else:
                                percent = marks
                        else:
                            percent = round((marks / max_marks) * 100, 2) if max_marks > 0 else marks
                        results.append({"subject": subject, "marks": marks, "max_marks": max_marks, "percent": percent, "raw": raw, "test": test_name})
                if results:
                    continue  # done with this table, don't fall through to vertical parser

        # Vertical layout: one test per page, rows = subjects, cols include subject+marks
        has_subject = any("subject" in h or "course" in h or "paper" in h or "code" in h for h in headers_lower)
        has_marks = any("mark" in h or "score" in h or "obtained" in h or "total" in h or "max" in h for h in headers_lower)

        # Fallback heuristic: if headers don't look like subject/marks but rows do
        if not (has_subject or has_marks):
            rows = table.find_all("tr")
            sample = None
            for row in rows[1:4]:
                cols = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
                if len(cols) >= 2 and _looks_like_subject(cols[0]) and re.search(r"\d", " ".join(cols[1:])):
                    sample = cols
                    break
            if not sample:
                # Also try col 1 as subject (S.No in col 0)
                for row in rows[1:4]:
                    cols = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
                    if len(cols) >= 3 and _looks_like_subject(cols[1]) and re.search(r"\d", " ".join(cols[2:])):
                        sample = cols
                        headers = ["sno", "subject", "marks"] + [""] * (len(cols) - 3)
                        headers_lower = [h.lower() for h in headers]
                        has_subject = True
                        has_marks = True
                        break
            if not sample:
                continue
            if not has_subject and not has_marks:
                # Infer: col 0 subject, col 1 marks (2-col simple table)
                headers = ["subject", "marks"] + [""] * (len(sample) - 2)
                headers_lower = [h.lower() for h in headers]
                has_subject = True
                has_marks = True

        # Map indices
        # Subject index: prefer explicit subject header, else first column that looks like subject code in sample
        subj_idx = next((i for i, h in enumerate(headers_lower) if "subject" in h or "course" in h or "paper" in h), None)
        if subj_idx is None:
            # detect code column
            subj_idx = next((i for i, h in enumerate(headers_lower) if "code" in h), None)
        if subj_idx is None:
            subj_idx = 0
            # if col 0 is sno numeric and col1 looks like code, shift
            rows_sample = table.find_all("tr")[1:3]
            for r in rows_sample:
                cols = [td.get_text(strip=True) for td in r.find_all(["td", "th"])]
                if len(cols) >= 2 and cols[0].isdigit() and _is_subject_code(cols[1]):
                    subj_idx = 1
                    break

        marks_idx = next((i for i, h in enumerate(headers_lower) if ("mark" in h or "obtained" in h or "score" in h) and "max" not in h and "total" not in h), None)
        if marks_idx is None:
            # fallback: column after subject that contains numeric
            marks_idx = subj_idx + 1 if len(headers) > subj_idx + 1 else (1 if len(headers) > 1 else subj_idx)
        max_idx = next((i for i, h in enumerate(headers_lower) if "max" in h or "total" in h or "out of" in h), None)

        for row in table.find_all("tr")[1:]:
            cols = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
            if len(cols) <= max(subj_idx, marks_idx or subj_idx):
                continue
            subject = cols[subj_idx].strip()
            if not _looks_like_subject(subject):
                continue
            if "no data" in " ".join(cols).lower():
                continue
            marks_raw = cols[marks_idx] if marks_idx is not None and marks_idx < len(cols) else ""
            if not marks_raw or marks_raw.strip() in ("-", "--"):
                continue
            m = re.search(r"(\d+(?:\.\d+)?)\s*(?:/\s*(\d+(?:\.\d+)?))?", marks_raw)
            if not m:
                continue
            marks = float(m.group(1))
            max_marks = float(m.group(2)) if m.group(2) else None
            if max_idx is not None and max_idx < len(cols):
                mx = re.search(r"(\d+(?:\.\d+)?)", cols[max_idx])
                if mx:
                    max_marks = float(mx.group(1))
            percent = round((marks / max_marks) * 100, 2) if max_marks and max_marks > 0 else marks
            results.append({"subject": subject, "marks": marks, "max_marks": max_marks, "percent": percent, "raw": marks_raw})
    return results


def _clean_form_action(raw: str | None) -> str:
    if not raw:
        return ERP_MARKS_REPORT
    raw = raw.strip()
    # Fix malformed like " https://erp.psit.ac.in/ https://erp.psit.ac.in/Student/TestSubjectMarksReport"
    # Extract last http URL if multiple
    urls = re.findall(r"https?://[^\s\"'<>]+", raw)
    if urls:
        return urls[-1].rstrip("/\"'")
    if raw.startswith("http"):
        return raw
    if raw.startswith("/"):
        return ERP_BASE + raw
    if raw:
        return ERP_BASE + "/" + raw.lstrip("/")
    return ERP_MARKS_REPORT

def _fetch_marks(client: httpx.Client) -> dict[str, Any]:
    all_marks: list[dict[str, Any]] = []
    debug: list[str] = []

    try:
        r = client.get(ERP_MARKS_REPORT, timeout=TIMEOUT)
        html = r.text
        if 'name="username"' in html and 'name="password"' in html:
            debug.append("marks page redirected to login")
            return {"subjects": [], "debug": debug}
        soup = BeautifulSoup(html, "html.parser")
        select = soup.find("select")
        sel_name = select.get("name") if select and select.get("name") else None
        sel_id = select.get("id") if select and select.get("id") else None
        form = soup.find("form")
        form_action_raw = form.get("action") if form and form.get("action") else ERP_MARKS_REPORT
        form_action = _clean_form_action(form_action_raw)
        debug.append(f"discovered select name={sel_name!r} id={sel_id!r} form_action={form_action!r} raw={form_action_raw!r}")

        # Discover options — keep both display and value for debug
        options: list[tuple[str, str]] = []
        for opt in soup.find_all("option"):
            txt = opt.get_text(strip=True)
            val = opt.get("value", "").strip()
            if txt and txt.lower() not in ("select test here", "select test", "select test:"):
                options.append((txt, val if val and val not in ("", txt) else txt))
        debug.append(f"options discovered: {options[:8]}")
        # Hidden inputs (ASPNET viewstate etc) — must be sent back with POST
        hidden_inputs = {inp.get("name"): inp.get("value","") for inp in soup.find_all("input", {"type":"hidden"}) if inp.get("name")}
        if hidden_inputs:
            debug.append(f"hidden inputs: {list(hidden_inputs.keys())[:5]}")

        if not options:
            for t in ["CT-1", "CT-2", "ASG-1", "AT-1", "ASG-2", "AT-2"]:
                options.append((t, t))

        # Look for AJAX endpoints in scripts
        ajax_candidates = []
        for script in soup.find_all("script"):
            txt = script.string or ""
            for m in re.finditer(r'["\'](/Student/[^"\']+)["\']', txt):
                ajax_candidates.append(ERP_BASE + m.group(1))
            # also look for full URLs
            for m in re.finditer(r"https?://erp\.psit\.ac\.in/[^\s\"']+", txt):
                ajax_candidates.append(m.group(0))
        if ajax_candidates:
            debug.append(f"js ajax candidates: {list(dict.fromkeys(ajax_candidates))[:3]}")

        # Try parsing GET page first (maybe marks already rendered — e.g. wide table with all tests)
        parsed = _parse_marks_table(html)
        if parsed:
            # If parser already tagged test per column (transposed), keep it; else tag with first option
            has_test_tag = any("test" in row for row in parsed)
            if not has_test_tag:
                for row in parsed:
                    row["test"] = options[0][0] if options else "Unknown"
            debug.append(f"GET found {len(parsed)} rows: {parsed[:2]}")
            all_marks.extend(parsed)
        else:
            # Debug snippet for diagnosis
            snippet = re.sub(r"\s+", " ", html[:1200])[:600]
            debug.append(f"GET no rows; html snippet: {snippet[:300]}")

        # Try each discovered test via POST (live per-test page)
        for display, value in options[:10]:
            # Skip if we already have transposed data covering this test
            if any(m.get("test") == display for m in all_marks):
                debug.append(f"skip POST {display} — already have from GET transposed table")
                continue
            tried = False

            # 0) Try GET with query string — some ERPs use GET ?cTest=ASG-1
            for get_key in ([sel_name] if sel_name else []) + ["cTest", "test", "test_name"]:
                try:
                    resp = client.get(f"{form_action}?{get_key}={value}", timeout=TIMEOUT, headers={"Referer": ERP_MARKS_REPORT})
                    p2 = _parse_marks_table(resp.text)
                    if p2:
                        for row in p2:
                            if "test" not in row:
                                row["test"] = display
                            if row.get("max_marks") is None and row.get("test","").upper().startswith("ASG") and row.get("marks", 0) <= 10:
                                row["percent"] = round(row["marks"] * 10, 2)
                                row["max_marks"] = 10.0
                        all_marks.extend(p2)
                        debug.append(f"GET {get_key}={value!r} -> {form_action} found {len(p2)} rows")
                        tried = True
                        break
                except Exception:
                    continue
            if tried:
                continue

            payload_variants: list[dict[str, str]] = []
            # Include hidden inputs as base for POST (viewstate etc)
            base_hidden = dict(hidden_inputs) if hidden_inputs else {}
            if sel_name:
                # Prefer discovered name with both value and display
                for v in ([value, display] if value != display else [value]):
                    payload_variants.append({**base_hidden, sel_name: v})
                if sel_id and sel_id != sel_name:
                    for v in ([value, display] if value != display else [value]):
                        payload_variants.append({**base_hidden, sel_id: v})
            for k in ["test", "test_name", "test_id", "exam_id", "examId", "id", "testId", "cTest"]:
                for v in ([value, display] if value != display else [value]):
                    payload_variants.append({**base_hidden, k: v})

            for payload in payload_variants:
                try:
                    resp = client.post(form_action, data=payload, timeout=TIMEOUT, headers={"Referer": ERP_MARKS_REPORT, "Origin": ERP_BASE, "X-Requested-With": "XMLHttpRequest"})
                    if 'name="username"' in resp.text:
                        debug.append(f"POST {display} session expired via {list(payload.keys())[0]}")
                        break
                    p2 = _parse_marks_table(resp.text)
                    if p2:
                        for row in p2:
                            if "test" not in row:
                                row["test"] = display
                            if row.get("max_marks") is None and row.get("test","").upper().startswith("ASG") and row.get("marks", 0) <= 10:
                                row["percent"] = round(row["marks"] * 10, 2)
                                row["max_marks"] = 10.0
                        all_marks.extend(p2)
                        debug.append(f"POST {display} via {list(payload.keys())[0]}={list(payload.values())[0]!r} -> {form_action} found {len(p2)} rows")
                        tried = True
                        break
                    # Try JSON — handle object list and DataTables array-of-arrays
                    try:
                        j = resp.json()
                        if isinstance(j, dict):
                            if "data" in j:
                                j = j["data"]
                            elif "aaData" in j:
                                j = j["aaData"]
                        if isinstance(j, list) and j:
                            added = 0
                            for item in j:
                                if isinstance(item, dict):
                                    subj = item.get("subject") or item.get("Subject") or item.get("course") or item.get("Course") or item.get("subject_code") or item.get("subjectCode")
                                    mk = item.get("marks") or item.get("Marks") or item.get("obtained") or item.get("Obtained") or item.get("score") or item.get("Score")
                                    maxv = item.get("max") or item.get("max_marks") or item.get("Max")
                                    if subj and mk is not None:
                                        try:
                                            marks_f = float(re.search(r"[\d.]+", str(mk)).group())
                                            max_f = float(re.search(r"[\d.]+", str(maxv)).group()) if maxv and re.search(r"[\d.]+", str(maxv)) else None
                                            percent = round(marks_f / max_f * 100, 2) if max_f else (round(marks_f*10,2) if display.upper().startswith("ASG") and marks_f<=10 else marks_f)
                                            all_marks.append({"subject": str(subj).strip(), "marks": marks_f, "max_marks": max_f, "percent": percent, "test": display, "raw": str(mk)})
                                            added += 1
                                        except Exception:
                                            pass
                                elif isinstance(item, list) and len(item) >= 2:
                                    subj = None
                                    marks_f = None
                                    max_f = None
                                    for cell in item:
                                        cell_s = str(cell).strip()
                                        if not subj and _looks_like_subject(cell_s):
                                            subj = cell_s
                                        elif re.match(r"^\d+(?:\.\d+)?(?:\s*/\s*\d+(?:\.\d+)?)?$", cell_s):
                                            m = re.search(r"(\d+(?:\.\d+)?)\s*(?:/\s*(\d+(?:\.\d+)?))?", cell_s)
                                            if m:
                                                marks_f = float(m.group(1))
                                                if m.group(2):
                                                    max_f = float(m.group(2))
                                            break
                                    if subj and marks_f is not None:
                                        percent = round(marks_f / max_f * 100, 2) if max_f else (round(marks_f*10,2) if display.upper().startswith("ASG") and marks_f<=10 else marks_f)
                                        all_marks.append({"subject": subj, "marks": marks_f, "max_marks": max_f, "percent": percent, "test": display, "raw": str(marks_f)})
                                        added += 1
                            if added:
                                debug.append(f"JSON {form_action} {display}: found {added} rows")
                                tried = True
                                break
                    except Exception:
                        pass
                except Exception as e:
                    debug.append(f"POST {display} {payload} err {e}")
            if not tried:
                for ajax_url in list(dict.fromkeys(ajax_candidates))[:3] + [f"{ERP_BASE}/Student/GetTestMarks", f"{ERP_BASE}/Student/GetStudentMarks"]:
                    try:
                        resp = client.post(ajax_url, data={sel_name: value} if sel_name else {"test": display, "cTest": display}, timeout=TIMEOUT)
                        if resp.status_code == 404:
                            continue
                        p2 = _parse_marks_table(resp.text)
                        if p2:
                            for row in p2:
                                if "test" not in row:
                                    row["test"] = display
                                if row.get("max_marks") is None and row.get("test","").upper().startswith("ASG") and row.get("marks", 0) <= 10:
                                    row["percent"] = round(row["marks"] * 10, 2)
                                    row["max_marks"] = 10.0
                            all_marks.extend(p2)
                            debug.append(f"AJAX {ajax_url} {display} found {len(p2)}")
                            tried = True
                            break
                    except Exception:
                        continue
                if not tried:
                    # capture last POST preview for diagnosis
                    try:
                        last = client.post(form_action, data={sel_name: value} if sel_name else {"cTest": value}, timeout=TIMEOUT, headers={"Referer": ERP_MARKS_REPORT, "Origin": ERP_BASE})
                        preview = re.sub(r"\s+", " ", last.text[:400])[:200]
                        debug.append(f"POST {display}: no rows — last resp {last.status_code} {len(last.text)} chars preview: {preview}")
                    except Exception:
                        pass
                    debug.append(f"POST {display}: no rows found after all variants")

    except Exception as e:
        debug.append(f"marks fetch error: {e}")

    # Deduplicate by (subject, test)
    seen = set()
    deduped = []
    for m in all_marks:
        key = (m["subject"].lower().strip(), m.get("test", ""))
        if key not in seen:
            seen.add(key)
            deduped.append(m)
    avg = None
    if deduped:
        vals = [r["percent"] for r in deduped if r.get("percent") is not None]
        if vals:
            # For ASG out of 10 we already converted to percent; otherwise raw
            avg = round(sum(vals) / len(vals), 2)
    return {"subjects": deduped, "avg_percent": avg, "debug": debug}


def scrape_psit_erp(username: str, password: str) -> dict[str, Any]:
    if not username or not password:
        raise ValueError("ERP User ID and password are required.")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": ERP_BASE + "/",
    }
    with httpx.Client(timeout=TIMEOUT, follow_redirects=True, headers=headers) as client:
        try:
            r = client.get(ERP_BASE + "/", timeout=TIMEOUT)
            r.raise_for_status()
        except Exception as e:
            raise ValueError(f"Could not reach PSIT ERP ({e}).") from e
        try:
            resp = client.post(ERP_AUTH, data={"username": username.strip(), "password": password}, headers={**headers, "Content-Type": "application/x-www-form-urlencoded", "Origin": ERP_BASE, "Referer": ERP_BASE + "/"})
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
        try:
            dash = client.get(ERP_DASHBOARD, timeout=TIMEOUT)
            dash.raise_for_status()
            html = dash.text
        except Exception as e:
            raise ValueError(f"Logged in but could not load ERP dashboard ({e}).") from e
        if 'name="username"' in html and 'name="password"' in html:
            raise ValueError("PSIT ERP login failed — invalid credentials or session expired.")
        parsed = _parse_attendance(html)
        if parsed["attendance_pct"] is None:
            raise ValueError(f"Could not find attendance on dashboard. Snippet: {parsed['raw_text_snippet'][:300]}")
        marks_data = _fetch_marks(client)
        return {"erp_id": username.strip(), "attendance_pct": parsed["attendance_pct"], "with_pf_pct": parsed["with_pf_pct"], "without_pf_pct": parsed["without_pf_pct"], "tl": parsed["tl"], "present": parsed["present"], "pf": parsed["pf"], "absent": parsed["absent"], "section": parsed["section"], "marks": marks_data["subjects"], "avg_marks_percent": marks_data["avg_percent"], "marks_debug": marks_data["debug"], "scraped_at": __import__("datetime").datetime.utcnow().isoformat() + "Z"}
