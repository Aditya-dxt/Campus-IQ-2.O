import os
import sys
from pathlib import Path

# Force UTF-8 output to prevent crash on Windows console with Dirac notation (⟩)
sys.stdout.reconfigure(encoding='utf-8')

# Add backend directory to sys.path to import services
BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from services.rag_pipeline import ingest_document, ask_question, suggest_questions

SAMPLE_NOTES_PATH = Path(__file__).resolve().parent / "sample_notes.txt"

# 20 Test Questions
# 15 should be answerable from the text, 5 should NOT be answerable (anti-hallucination test)
TEST_QUESTIONS = [
    # --- Answerable Questions (15) ---
    {"q": "What is a quantum bit also known as?", "answerable": True},
    {"q": "How is the state of a qubit typically represented?", "answerable": True},
    {"q": "What is the normalization condition for a general quantum state?", "answerable": True},
    {"q": "What happens when two qubits are entangled and you measure one of them?", "answerable": True},
    {"q": "What did Albert Einstein call quantum entanglement?", "answerable": True},
    {"q": "What is the quantum equivalent of the classical NOT gate?", "answerable": True},
    {"q": "What happens when you apply a Hadamard gate to the state |0⟩?", "answerable": True},
    {"q": "How does a CNOT gate work?", "answerable": True},
    {"q": "What is quantum decoherence?", "answerable": True},
    {"q": "What happens when a quantum system interacts with its environment?", "answerable": True},
    {"q": "What is the biggest challenge in building practical quantum computers?", "answerable": True},
    {"q": "What semester is this course taught in?", "answerable": True},
    {"q": "Who is the professor teaching this course?", "answerable": True},
    {"q": "What are the two basis states of a qubit?", "answerable": True},
    {"q": "What are quantum logic gates represented by?", "answerable": True},
    
    # --- Unanswerable Questions (5) - Should trigger anti-hallucination guardrail ---
    {"q": "What is the professor's favorite color?", "answerable": False},
    {"q": "How do you build a topological quantum computer?", "answerable": False},
    {"q": "What is the weather like today?", "answerable": False},
    {"q": "Who won the World Series in 2023?", "answerable": False},
    {"q": "Explain string theory in detail.", "answerable": False},
]

def run_evaluation():
    print("="*60)
    print("Starting RAG Pipeline Evaluation")
    print("="*60)
    
    print("\n[1] Ingesting Document...")
    if not SAMPLE_NOTES_PATH.exists():
        print(f"Error: Could not find sample notes at {SAMPLE_NOTES_PATH}")
        return
        
    doc_info = ingest_document(str(SAMPLE_NOTES_PATH))
    doc_id = doc_info["doc_id"]
    print(f"Successfully ingested document. ID: {doc_id}")
    print(f"Number of chunks generated: {doc_info['num_chunks']}")
    
    print("\n[2] Checking Suggested Questions...")
    suggestions = suggest_questions(doc_id)
    print("Suggested Questions:")
    for i, sq in enumerate(suggestions):
        print(f"  {i+1}. {sq}")
        
    print("\n[3] Running QA Evaluation (Anti-Hallucination Guardrail Test)...")
    
    correct_grounded = 0
    correct_refusals = 0
    failed_refusals = 0
    failed_grounded = 0
    
    for i, test in enumerate(TEST_QUESTIONS):
        q = test["q"]
        is_answerable = test["answerable"]
        
        result = ask_question(doc_id, q)
        answer = result["answer"]
        
        # Check if the model triggered the guardrail
        refused = "not found in your notes" in answer.lower()
        
        if is_answerable:
            if not refused:
                correct_grounded += 1
                status = "[PASS] (Answered)"
            else:
                failed_grounded += 1
                status = "[FAIL] (Refused to answer valid question)"
        else:
            if refused:
                correct_refusals += 1
                status = "[PASS] (Correctly refused)"
            else:
                failed_refusals += 1
                status = f"[FAIL] (Hallucinated/Answered invalid question)"
                
        print(f"Q{i+1:02d}: {q}")
        print(f"  Status: {status}")
        if not refused and not is_answerable:
            print(f"  Hallucinated Answer: {answer}")
            
    print("\n" + "="*60)
    print("EVALUATION RESULTS")
    print("="*60)
    print(f"Answerable Questions Correctly Answered: {correct_grounded} / 15")
    print(f"Unanswerable Questions Correctly Refused: {correct_refusals} / 5")
    
    total_correct = correct_grounded + correct_refusals
    print(f"Total Accuracy: {total_correct} / 20 ({total_correct/20 * 100:.1f}%)")
    
    if failed_refusals > 0:
        print("\nWARNING: Anti-hallucination guardrail failed on some questions!")
    else:
        print("\nSUCCESS: Anti-hallucination guardrail working perfectly.")

if __name__ == "__main__":
    run_evaluation()
