"""Chat Router — RAG Study Assistant endpoints.

Handles document ingestion, question answering, and feedback logging.
All interactions are persisted to the Supabase `chat_feedback` table.
"""
import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, status
from pydantic import BaseModel, Field

from fastapi import Depends
from dependencies import CurrentUser, get_current_user
from config import BACKEND_ROOT
from services.rag_pipeline import ingest_document, ask_question, suggest_questions
from services.supabase_client import get_supabase_client

router = APIRouter(prefix="/chat", tags=["chat"])

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MAX_FILE_SIZE_MB = 10
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}
UPLOAD_DIR = BACKEND_ROOT / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------

class AskRequest(BaseModel):
    """Body for the /chat/ask endpoint."""
    doc_id: str = Field(..., min_length=1, description="The document ID returned by /chat/ingest.")
    question: str = Field(..., min_length=3, max_length=1000, description="The student's question.")


class FeedbackRequest(BaseModel):
    """Body for the /chat/feedback endpoint."""
    feedback_id: str = Field(..., min_length=1, description="The chat_feedback row ID.")
    thumbs: bool = Field(..., description="True = thumbs up, False = thumbs down.")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/")
def chat_root():
    """Health check for the chat module."""
    return {
        "status": "ok",
        "endpoints": [
            "POST /chat/ingest    — Upload a document for RAG",
            "GET  /chat/questions  — Get suggested questions for a doc",
            "POST /chat/ask        — Ask a question against a document",
            "POST /chat/feedback   — Submit thumbs up/down on an answer",
        ],
    }


@router.post("/ingest", status_code=status.HTTP_201_CREATED)
async def ingest_file(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """
    Upload a study document (PDF, DOCX, or TXT) for RAG ingestion.

    - Validates file type and size (<10 MB).
    - Extracts text, chunks it, embeds it, and stores in ChromaDB.
    - Returns the doc_id and suggested study questions.
    """
    # --- Validate file extension ---
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # --- Validate file size ---
    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large ({size_mb:.1f} MB). Maximum allowed: {MAX_FILE_SIZE_MB} MB.",
        )

    # --- Save to temp file so the pipeline can read it ---
    temp_path = UPLOAD_DIR / f"{current_user['sub']}_{file.filename}"
    try:
        with open(temp_path, "wb") as f:
            f.write(contents)

        # Call the RAG pipeline
        result = ingest_document(str(temp_path))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ingestion failed: {exc}",
        ) from exc
    finally:
        # Clean up the uploaded file
        if temp_path.exists():
            temp_path.unlink()

    return {
        "doc_id": result["doc_id"],
        "num_chunks": result["num_chunks"],
        "suggested_questions": result["suggested_questions"],
        "uploaded_by": current_user["sub"],
    }


@router.get("/questions")
def get_suggested_questions(doc_id: str, current_user: CurrentUser):
    """Return the AI-generated suggested questions for a document."""
    if not doc_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="doc_id query parameter is required.",
        )
    questions = suggest_questions(doc_id)
    return {"doc_id": doc_id, "suggested_questions": questions}


@router.post("/ask")
def ask_question_endpoint(body: AskRequest, current_user: CurrentUser):
    """
    Ask a question against an ingested document.

    - Retrieves relevant chunks from ChromaDB.
    - Calls the local Phi-3 LLM with anti-hallucination guardrails.
    - Logs the Q&A pair to the `chat_feedback` table for future review.
    """
    try:
        result = ask_question(body.doc_id, body.question)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate answer: {exc}",
        ) from exc

    # Log to Supabase chat_feedback table
    feedback_id = None
    try:
        supabase = get_supabase_client()
        insert_resp = supabase.table("chat_feedback").insert({
            "user_id": current_user["sub"],
            "doc_id": body.doc_id,
            "question": body.question,
            "answer": result["answer"],
            "thumbs": None,  # Not rated yet
        }).execute()
        if insert_resp.data:
            feedback_id = insert_resp.data[0].get("id")
    except Exception as exc:
        print(f"Warning: failed to log chat interaction to DB: {exc}")

    return {
        "feedback_id": feedback_id,
        "answer": result["answer"],
        "snippets": result["snippets"],
    }


@router.post("/feedback")
def submit_feedback(body: FeedbackRequest, current_user: CurrentUser):
    """
    Submit thumbs-up or thumbs-down feedback on a chatbot answer.

    Updates the `thumbs` column in the `chat_feedback` table.
    """
    try:
        supabase = get_supabase_client()
        response = (
            supabase.table("chat_feedback")
            .update({"thumbs": body.thumbs})
            .eq("id", body.feedback_id)
            .eq("user_id", current_user["sub"])  # Ensure ownership
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Feedback record not found or you don't own it.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save feedback: {exc}",
        ) from exc

    return {"status": "ok", "feedback_id": body.feedback_id, "thumbs": body.thumbs}
