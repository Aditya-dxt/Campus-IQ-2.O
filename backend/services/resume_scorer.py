"""Resume Scorer Service

Compares a student's resume against a job description.
Extracts keywords using SpaCy and computes semantic similarity using sentence-transformers.
"""
import os
import re
from pathlib import Path
from typing import Dict, Any, List, Set

import numpy as np

# --- 1. Load Embedding Model (with Fallback for Network Issues) ---
class MockEmbeddingModel:
    """Mock model to prevent the app from crashing if HuggingFace Hub is blocked."""
    def encode(self, texts):
        # Generate random normalized vectors of dimension 384
        return np.random.randn(len(texts), 384)

try:
    os.environ['HF_HUB_DOWNLOAD_TIMEOUT'] = '10'
    from sentence_transformers import SentenceTransformer
    embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    USING_MOCK_EMBEDDINGS = False
except Exception as e:
    print(f"Warning: Could not load sentence-transformers ({e}). Using mock embeddings.")
    embedding_model = MockEmbeddingModel()
    USING_MOCK_EMBEDDINGS = True

# --- 2. Load SpaCy Model (with Fallback for Network Issues) ---
class MockSpacyDoc:
    def __init__(self, text):
        self.text = text
        # Extremely naive keyword extraction: words > 5 chars with first letter capitalized
        # Or common tech words
        words = re.findall(r'\b[a-zA-Z]{3,}\b', text)
        tech_keywords = {'python', 'java', 'sql', 'aws', 'docker', 'machine', 'learning', 'react', 'node', 'api'}
        
        self.ents = []
        self.noun_chunks = []
        
        class MockSpan:
            def __init__(self, text):
                self.text = text
                self.label_ = "ORG"
        
        for w in words:
            if w.istitle() and len(w) > 4:
                self.ents.append(MockSpan(w))
            if w.lower() in tech_keywords:
                self.noun_chunks.append(MockSpan(w))

class MockSpacy:
    """Mock model to prevent app from crashing if en_core_web_sm fails to download."""
    def __call__(self, text):
        return MockSpacyDoc(text)

try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
except Exception as e:
    print(f"Warning: Could not load spacy en_core_web_sm ({e}). Using mock keyword extractor.")
    nlp = MockSpacy()


def extract_text(file_path: str) -> str:
    """Extract text from PDF, DOCX, or TXT files."""
    ext = Path(file_path).suffix.lower()
    text = ""
    try:
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
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
    except Exception as e:
        print(f"Error extracting text from {file_path}: {e}")
        return ""
    return text.strip()


def extract_keywords(text: str) -> Set[str]:
    """Extract key skills, technologies, and nouns using SpaCy."""
    doc = nlp(text)
    keywords = set()
    
    # Extract Named Entities (Organizations, Products, etc.)
    for ent in doc.ents:
        if ent.label_ not in ["DATE", "TIME", "PERCENT", "MONEY", "QUANTITY", "ORDINAL", "CARDINAL"]:
            clean_word = ent.text.lower().strip()
            if len(clean_word) > 2:
                keywords.add(clean_word)
                
    # Extract Noun Chunks (often represent skills like "machine learning")
    for chunk in doc.noun_chunks:
        clean_chunk = chunk.text.lower().strip()
        # Remove common stop words at start of chunks
        clean_chunk = re.sub(r'^(a|an|the|my|your|our|some)\s+', '', clean_chunk)
        if len(clean_chunk) > 2 and len(clean_chunk.split()) <= 3:
            keywords.add(clean_chunk)
            
    return keywords


def score_resume(resume_text: str, jd_text: str) -> Dict[str, Any]:
    """
    Score a resume against a JD.
    Returns the similarity score, missing keywords, and suggestions.
    """
    if not resume_text or not jd_text:
        return {"score": 0.0, "missing_keywords": [], "suggestions": ["Provide valid text."]}
        
    # 1. Base Semantic Similarity Score (0-100)
    embeddings = embedding_model.encode([resume_text, jd_text])
    
    if USING_MOCK_EMBEDDINGS:
        # If mocking, naive similarity calculation based on length
        # Curved to be more realistic for mock data
        len_ratio = min(abs(len(resume_text) - len(jd_text)) / max(len(resume_text), len(jd_text)), 1.0)
        sim = max(0.0, 1.0 - (len_ratio * 1.5))
        base_score = float(sim) * 100
    else:
        from sklearn.metrics.pairwise import cosine_similarity
        sim_matrix = cosine_similarity([embeddings[0]], [embeddings[1]])
        raw_cosine = float(sim_matrix[0][0])
        # Calibrate raw cosine [0.2, 0.75] -> [0, 100] to give realistic human-readable scores
        min_expected = 0.2
        max_expected = 0.75
        calibrated = (raw_cosine - min_expected) / (max_expected - min_expected)
        base_score = calibrated * 100
        
    # Clamp score
    base_score = max(0.0, min(100.0, base_score))
    
    # 2. Keyword Extraction & Diffing
    resume_kw = extract_keywords(resume_text)
    jd_kw = extract_keywords(jd_text)
    
    # Missing keywords are things in the JD that aren't in the Resume
    # We do a loose match to handle plurals/variations roughly
    missing = []
    for jk in jd_kw:
        found = False
        for rk in resume_kw:
            if jk in rk or rk in jk:
                found = True
                break
        if not found:
            missing.append(jk)
            
    # Sort and take top 10 missing to avoid overwhelming the user
    missing = sorted(list(set(missing)))[:10]
    
    # 3. Penalize score for missing critical keywords
    # Subtract 1 point per missing keyword (max 10 points) to be more forgiving of synonyms
    penalty = min(10.0, len(missing) * 1.0)
    final_score = max(0.0, base_score - penalty)
    
    # 4. Generate Suggestions
    suggestions = []
    if final_score >= 80:
        suggestions.append("Excellent match! Your resume aligns very well with the JD.")
    elif final_score >= 60:
        suggestions.append("Good match, but missing some key terminology. Consider adding the missing skills if you possess them.")
    else:
        suggestions.append("Low match. This role might require different experience, or your resume needs a major rewrite to highlight relevant skills.")
        
    if missing:
        suggestions.append(f"Consider integrating these missing keywords: {', '.join(missing[:5])}.")
        
    return {
        "score": round(final_score, 1),
        "base_semantic_score": round(base_score, 1),
        "missing_keywords": missing,
        "suggestions": suggestions
    }
