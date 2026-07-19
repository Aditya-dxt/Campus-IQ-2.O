"""End to end integration test script simulating the frontend flows."""
import httpx
import asyncio
from pathlib import Path
import os
import json

BASE_URL = "http://localhost:8000"

async def run_tests():
    print("--- Starting End-to-End API Integration Tests ---")
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # 1. Signup and Login as Mentor
        print("1. Mentor Flow")
        mentor_cred = {"email": "mentor_test@campusiq.com", "password": "password123"}
        try:
            res = await client.post("/auth/signup", json={
                "name": "Dr. Mentor", "email": mentor_cred["email"], 
                "password": mentor_cred["password"], "role": "mentor", "branch": None
            })
            if res.status_code == 400 and "already exists" in res.text:
                pass # Already registered
            else:
                res.raise_for_status()
        except Exception as e:
            print(f"Mentor signup error: {e}")

        res = await client.post("/auth/login", json=mentor_cred)
        res.raise_for_status()
        mentor_token = res.json()["access_token"]
        mentor_headers = {"Authorization": f"Bearer {mentor_token}"}
        
        # 2. Signup and Login as Student
        print("2. Student Flow")
        student_cred = {"email": "student_test@campusiq.com", "password": "password123"}
        try:
            res = await client.post("/auth/signup", json={
                "name": "Alex Student", "email": student_cred["email"], 
                "password": student_cred["password"], "role": "student", "branch": "Computer Science"
            })
            if res.status_code == 400 and "already exists" in res.text:
                pass # Already registered
            else:
                res.raise_for_status()
        except Exception as e:
            print(f"Student signup error: {e}")

        res = await client.post("/auth/login", json=student_cred)
        res.raise_for_status()
        student_token = res.json()["access_token"]
        student_headers = {"Authorization": f"Bearer {student_token}"}
        student_id = res.json()["user"]["id"]

        # 3. Test Student Resume Score
        print("-> Testing Resume")
        dummy_pdf_path = Path("dummy.txt")
        dummy_pdf_path.write_text("Experienced Python Developer with FastAPI and React skills. Graduated with Honors.")
        
        with open(dummy_pdf_path, "rb") as f:
            files = {"file": ("resume.txt", f, "text/plain")}
            data = {"job_description": "We are looking for a Python Developer who knows FastAPI, SQL, and React."}
            res = await client.post("/resume/score", files=files, data=data, headers=student_headers)
            res.raise_for_status()
            print("   Resume Score:", res.json()["score"])
            
        dummy_pdf_path.unlink()
        
        # 4. Test Student Chat
        print("-> Testing Chat")
        dummy_doc_path = Path("syllabus.txt")
        dummy_doc_path.write_text("The midterms are scheduled for October 15th. Topics include Data Structures and Graph Algorithms.")
        
        with open(dummy_doc_path, "rb") as f:
            files = {"file": ("syllabus.txt", f, "text/plain")}
            res = await client.post("/chat/ingest", files=files, headers=student_headers)
            res.raise_for_status()
            doc_id = res.json()["doc_id"]
            
        res = await client.post("/chat/ask", json={"doc_id": doc_id, "question": "When are the midterms?"}, headers=student_headers, timeout=60.0)
        res.raise_for_status()
        print("   Chat Answer:", res.json()["answer"])
        
        # 5. Test Mentor Views
        print("-> Testing Mentor Risk Dashboard")
        res = await client.get("/predict/cohort", headers=mentor_headers)
        res.raise_for_status()
        print("   Cohort Data:", res.json())
        
        print("-> Testing Mentor Intervention Create")
        res = await client.post("/intervention/create", json={
            "student_id": student_id,
            "action_note": "[academic_tutoring] Assigned 1-on-1 math tutoring for midterms.",
            "review_date": "2026-10-15"
        }, headers=mentor_headers)
        res.raise_for_status()
        print("   Intervention Logged!")
        
        # 6. Test RBAC (Student trying to hit Mentor Route)
        print("-> Testing RBAC protections")
        res = await client.get("/predict/cohort", headers=student_headers)
        if res.status_code == 403:
            print("   SUCCESS: Student blocked from /predict/cohort")
        else:
            print(f"   FAIL: Student got status {res.status_code} on /predict/cohort")
            
    print("--- Tests Complete ---")

if __name__ == "__main__":
    asyncio.run(run_tests())
