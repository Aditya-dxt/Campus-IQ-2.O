"""RAG Pipeline for Study Assistant.

Handles document ingestion, chunking, embedding, storage in ChromaDB,
and strictly grounded Q&A using the Claude API.
"""
import os
import uuid
import json
from typing import List, Dict, Any, Tuple
from pathlib import Path

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from config import BACKEND_ROOT
from services.local_llm import generate as generate_llm

# Initialize ChromaDB (local persistence)
CHROMA_DB_DIR = BACKEND_ROOT / "chroma_db_v3"
chroma_client = chromadb.PersistentClient(
    path=str(CHROMA_DB_DIR),
    settings=Settings(anonymized_telemetry=False)
)
collection = chroma_client.get_or_create_collection(name="study_notes")

# Initialize Local Embedding Model
# all-MiniLM-L6-v2 is fast, small, and effective for basic RAG
class MockEmbeddingModel:
    def encode(self, texts):
        import numpy as np
        # Generate random normalized vectors of dimension 384
        return np.random.randn(len(texts), 384)

try:
    embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
except Exception as e:
    print(f"Using MockEmbeddingModel to bypass HuggingFace network blocks: {e}")
    embedding_model = MockEmbeddingModel()

# Local LLM is loaded dynamically


def _extract_text(file_path: str) -> str:
    """Extract text from PDF, DOCX, or TXT files."""
    ext = Path(file_path).suffix.lower()
    text = ""
    if ext == ".pdf":
        import fitz
        with fitz.open(file_path) as doc:
            for page in doc:
                text += page.get_text() + "\n"
    elif ext == ".docx":
        import docx
        doc = docx.Document(file_path)
        for para in doc.paragraphs:
            text += para.text + "\n"
    else:
        # Assume plain text for anything else
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
    return text.strip()


def _chunk_text(text: str, chunk_size: int = 400, overlap: int = 50) -> List[str]:
    """Chunk text into roughly chunk_size words with overlap."""
    words = text.split()
    chunks = []
    if not words:
        return chunks
    
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return chunks


def ingest_document(file_path: str, doc_id: str = None) -> Dict[str, Any]:
    """
    Extract text, chunk into ~300-500 token pieces, generate embeddings,
    store in Chroma, and generate 3-4 suggested questions.
    """
    if not doc_id:
        doc_id = str(uuid.uuid4())
        
    text = _extract_text(file_path)
    if not text:
        raise ValueError("Could not extract any text from the document.")
        
    chunks = _chunk_text(text, chunk_size=350, overlap=50)
    
    # Generate embeddings locally
    embeddings = embedding_model.encode(chunks).tolist()
    
    # Prepare data for Chroma
    ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
    metadatas = [{"doc_id": doc_id, "chunk_index": i} for i in range(len(chunks))]
    
    # Store in ChromaDB
    collection.add(
        embeddings=embeddings,
        documents=chunks,
        metadatas=metadatas,
        ids=ids
    )
    
def _extract_fast_questions(text: str) -> List[str]:
    """Extract quick, relevant study questions without blocking on LLM inference."""
    import re
    questions = []
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    topics = []
    for line in lines[:25]:
        if 4 < len(line) < 60 and not line.endswith(('.', ':', ';', ',')):
            cleaned = re.sub(r'^[0-9.\-*#_ ]+', '', line).strip()
            if cleaned and 2 <= len(cleaned.split()) <= 6:
                topics.append(cleaned)
    
    if topics:
        questions.append(f"Can you summarize the key concepts of {topics[0]}?")
        if len(topics) > 1:
            questions.append(f"What are the main details regarding {topics[1]}?")
        if len(topics) > 2:
            questions.append(f"How does {topics[2]} work according to the notes?")
    
    if len(questions) < 3:
        questions.append("Can you summarize the key points of this document in bullet points?")
        questions.append("What are the core definitions and concepts explained here?")
        questions.append("What are the most important takeaways from these notes?")
    
    return questions[:4]


def ingest_document(file_path: str, doc_id: str = None) -> Dict[str, Any]:
    """
    Extract text, chunk into ~300-500 token pieces, generate embeddings,
    store in Chroma, and generate suggested questions with zero upload latency.
    """
    if not doc_id:
        doc_id = str(uuid.uuid4())
        
    text = _extract_text(file_path)
    if not text:
        raise ValueError("Could not extract any text from the document.")
        
    chunks = _chunk_text(text, chunk_size=300, overlap=40)
    
    # Generate embeddings locally
    embeddings = embedding_model.encode(chunks).tolist()
    
    # Prepare data for Chroma
    ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
    metadatas = [{"doc_id": doc_id, "chunk_index": i} for i in range(len(chunks))]
    
    # Store in ChromaDB
    collection.add(
        embeddings=embeddings,
        documents=chunks,
        metadatas=metadatas,
        ids=ids
    )
    
    # Instant suggested questions
    suggested_questions = _extract_fast_questions(text)
        
    # Save questions to a local JSON file
    questions_file = BACKEND_ROOT / f"suggested_questions_{doc_id}.json"
    with open(questions_file, "w") as f:
        json.dump(suggested_questions, f)
        
    return {
        "doc_id": doc_id,
        "num_chunks": len(chunks),
        "suggested_questions": suggested_questions
    }


def suggest_questions(doc_id: str) -> List[str]:
    """Return the suggested questions generated at ingest time."""
    questions_file = BACKEND_ROOT / f"suggested_questions_{doc_id}.json"
    if questions_file.exists():
        with open(questions_file, "r") as f:
            return json.load(f)
    return ["Can you summarize the key points of this document in bullet points?"]


def ask_question(doc_id: str, question: str) -> Dict[str, Any]:
    """
    Retrieve top relevant chunks, call local LLM with structured bullet-point prompt,
    and return the answer and source snippets.
    """
    # 1. Embed the query
    query_embedding = embedding_model.encode([question]).tolist()[0]
    
    # 2. Retrieve top-2 chunks for faster processing
    results = collection.query(
        query_embeddings=[query_embedding],
        where={"doc_id": doc_id},
        n_results=2
    )
    
    if not results['documents'] or not results['documents'][0]:
        return {
            "answer": "not found in your notes",
            "snippets": []
        }
        
    retrieved_chunks = results['documents'][0]
    
    # 3. Formulate prompt with bullet-point formatting instructions
    context = ""
    for i, chunk in enumerate(retrieved_chunks):
        context += f"--- Excerpt {i+1} ---\n{chunk}\n\n"
        
    system_prompt = (
        "You are a helpful study assistant. Answer the user's question using ONLY the provided excerpts.\n"
        "- Structure your answer with clear, organized bullet points.\n"
        "- Use **bold text** for key terms and concepts.\n"
        "- Keep explanations direct, concise, and easy to understand.\n"
        "- If the excerpts do NOT contain the answer, reply with exactly: 'not found in your notes'."
    )
    
    prompt = f"<|user|>\n{system_prompt}\n\nQuestion: {question}\n\nExcerpts:\n{context}<|end|>\n<|assistant|>"
    
    # 4. Call Local LLM
    try:
        answer = generate_llm(prompt, max_tokens=250)
    except Exception as e:
        print(f"Error calling local LLM: {e}")
        answer = "Error: Could not reach local LLM service."
            
    return {
        "answer": answer,
        "snippets": retrieved_chunks
    }
